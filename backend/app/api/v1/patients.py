import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut, PatientListItem, RewardsSummary
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["Pacientes"])


def _serialize(patient) -> dict:
    rewards = patient.rewards_account
    return {
        "id": str(patient.id),
        "clinic_id": str(patient.clinic_id),
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "full_name": patient.full_name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender,
        "id_number": patient.id_number,
        "phone": patient.phone,
        "phone_secondary": patient.phone_secondary,
        "email": patient.email,
        "address": patient.address,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "blood_type": patient.blood_type,
        "allergies": patient.allergies,
        "medical_conditions": patient.medical_conditions,
        "current_medications": patient.current_medications,
        "referred_by_patient_id": str(patient.referred_by_patient_id) if patient.referred_by_patient_id else None,
        "is_active": patient.is_active,
        "first_visit_date": patient.first_visit_date.isoformat() if patient.first_visit_date else None,
        "notes": patient.notes,
        "rewards": {
            "level": rewards.level,
            "total_points": rewards.total_points,
            "benefits_suspended": rewards.benefits_suspended,
        } if rewards else None,
        "created_at": patient.created_at.isoformat(),
        "updated_at": patient.updated_at.isoformat(),
    }


def _serialize_list_item(patient) -> dict:
    rewards = patient.rewards_account
    return {
        "id": str(patient.id),
        "full_name": patient.full_name,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "phone": patient.phone,
        "email": patient.email,
        "is_active": patient.is_active,
        "rewards_level": rewards.level if rewards else None,
        "rewards_points": rewards.total_points if rewards else None,
        "first_visit_date": patient.first_visit_date.isoformat() if patient.first_visit_date else None,
        "created_at": patient.created_at.isoformat(),
    }


@router.post("", status_code=201)
async def create_patient(
    body: PatientCreate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient = await patient_service.create_patient(db, user.clinic_id, body)
    return {"success": True, "data": _serialize(patient)}


@router.get("")
async def list_patients(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = Query(default=None, description="Buscar por nombre, teléfono o email"),
    level: str | None = Query(default=None, description="Filtrar por nivel Smile Rewards"),
    active_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
):
    patients, total = await patient_service.list_patients(
        db,
        clinic_id=user.clinic_id,
        search=search,
        level=level,
        active_only=active_only,
        page=page,
        per_page=per_page,
    )
    import math
    return {
        "success": True,
        "data": [_serialize_list_item(p) for p in patients],
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0,
        },
    }


@router.get("/search")
async def search_patients(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str = Query(min_length=2, description="Término de búsqueda"),
    limit: int = Query(default=10, ge=1, le=20),
):
    """Búsqueda rápida para autocompletar en formularios."""
    patients = await patient_service.search_patients_simple(db, user.clinic_id, q, limit)
    return {
        "success": True,
        "data": [
            {
                "id": str(p.id),
                "full_name": p.full_name,
                "phone": p.phone,
                "rewards_level": p.rewards_account.level if p.rewards_account else None,
            }
            for p in patients
        ],
    }


@router.get("/{patient_id}")
async def get_patient(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient = await patient_service.get_patient(db, user.clinic_id, patient_id)
    return {"success": True, "data": _serialize(patient)}


@router.patch("/{patient_id}")
async def update_patient(
    patient_id: uuid.UUID,
    body: PatientUpdate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient = await patient_service.update_patient(db, user.clinic_id, patient_id, body)
    return {"success": True, "data": _serialize(patient)}


@router.delete("/{patient_id}", status_code=200)
async def deactivate_patient(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("delete_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await patient_service.deactivate_patient(db, user.clinic_id, patient_id)
    return {"success": True, "data": {"message": "Paciente desactivado correctamente."}}


@router.post("/{patient_id}/reactivate", status_code=200)
async def reactivate_patient(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient = await patient_service.get_patient(db, user.clinic_id, patient_id)
    patient.is_active = True
    await db.commit()
    return {"success": True, "data": {"message": "Paciente reactivado."}}


@router.delete("/{patient_id}/permanent", status_code=200)
async def delete_patient_permanent(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("delete_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Elimina el paciente de forma permanente. Falla si tiene registros vinculados."""
    patient = await patient_service.get_patient(db, user.clinic_id, patient_id)
    try:
        await db.delete(patient)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Este paciente tiene registros vinculados (citas, tratamientos, finanzas, etc.). Usa 'Desactivar' en su lugar.",
        )
    return {"success": True, "data": {"message": "Paciente eliminado permanentemente."}}
