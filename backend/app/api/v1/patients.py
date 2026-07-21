import uuid
from datetime import date as date_type
from typing import Annotated, Literal

import logging
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select, desc, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.exceptions import NotFoundError
from app.schemas.patient import PatientCreate, PatientUpdate, PatientOut, PatientListItem, RewardsSummary
from app.services import patient_service

router = APIRouter(prefix="/patients", tags=["Pacientes"])


# ─── Evolución clínica ────────────────────────────────────────────────────────

class EvolutionCreate(BaseModel):
    date: date_type
    note: str
    attendance: Literal["asistio", "no_asistio"] | None = None

    @field_validator("note")
    @classmethod
    def note_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("La nota no puede estar vacía.")
        return v.strip()


class EvolutionUpdate(BaseModel):
    date: date_type | None = None
    note: str | None = None
    attendance: Literal["asistio", "no_asistio"] | None = None


def _serialize(patient, referred_by_name: str | None = None) -> dict:
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
        "city": patient.city,
        "country": patient.country,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
        "blood_type": patient.blood_type,
        "allergies": patient.allergies,
        "medical_conditions": patient.medical_conditions,
        "current_medications": patient.current_medications,
        "chief_complaint": patient.chief_complaint,
        "referred_by_patient_id": str(patient.referred_by_patient_id) if patient.referred_by_patient_id else None,
        "referred_by_name": referred_by_name,
        "is_active": patient.is_active,
        "patient_number": patient.patient_number,
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
        "patient_number": patient.patient_number,
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
    q: str = Query(default="", description="Término de búsqueda (vacío = todos)"),
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


async def _get_referrer_name(db, referred_by_patient_id) -> str | None:
    if not referred_by_patient_id:
        return None
    from app.models.patient import Patient as _Patient
    result = await db.execute(
        select(_Patient.first_name, _Patient.last_name).where(
            _Patient.id == referred_by_patient_id
        )
    )
    row = result.one_or_none()
    return f"{row.first_name} {row.last_name}" if row else None


@router.get("/{patient_id}")
async def get_patient(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient = await patient_service.get_patient(db, user.clinic_id, patient_id)
    referred_by_name = await _get_referrer_name(db, patient.referred_by_patient_id)
    return {"success": True, "data": _serialize(patient, referred_by_name)}


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


class SetReferralRequest(BaseModel):
    referrer_patient_id: uuid.UUID | None


@router.patch("/{patient_id}/referral")
async def set_referral(
    patient_id: uuid.UUID,
    body: SetReferralRequest,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    patient, points_awarded = await patient_service.set_referral(
        db, user.clinic_id, patient_id, body.referrer_patient_id
    )
    referred_by_name = await _get_referrer_name(db, patient.referred_by_patient_id)
    return {
        "success": True,
        "data": _serialize(patient, referred_by_name),
        "points_awarded": points_awarded,
    }


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
    """Elimina el paciente y todos sus registros vinculados de forma permanente."""
    # Vaciamos el identity map antes de operar para que get_db no haga flush de
    # ningún objeto ORM al commitar al finalizar el request.
    db.sync_session.expunge_all()
    try:
        await patient_service.delete_patient_permanent(user.clinic_id, patient_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Paciente no encontrado.")
    except Exception as e:
        logging.exception("Error al eliminar paciente %s", patient_id)
        raise HTTPException(status_code=500, detail=f"Error al eliminar paciente: {str(e)}")
    return {"success": True, "data": {"message": "Paciente eliminado permanentemente."}}


def _serialize_evo(evo) -> dict:
    return {
        "id": str(evo.id),
        "patient_id": str(evo.patient_id),
        "date": evo.date.isoformat(),
        "note": evo.note,
        "attendance": evo.attendance,
        "created_by": {
            "id": str(evo.created_by.id),
            "full_name": evo.created_by.full_name,
        } if evo.created_by else None,
        "created_at": evo.created_at.isoformat(),
        "updated_at": evo.updated_at.isoformat(),
    }


async def _get_evo(db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, evolution_id: uuid.UUID):
    from app.models.evolution import PatientEvolution
    result = await db.execute(
        select(PatientEvolution)
        .where(
            PatientEvolution.id == evolution_id,
            PatientEvolution.clinic_id == clinic_id,
            PatientEvolution.patient_id == patient_id,
        )
        .options(selectinload(PatientEvolution.created_by))
    )
    evo = result.scalar_one_or_none()
    if not evo:
        raise HTTPException(status_code=404, detail="Nota de evolución no encontrada.")
    return evo


@router.get("/{patient_id}/evolutions")
async def list_evolutions(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.evolution import PatientEvolution
    result = await db.execute(
        select(PatientEvolution)
        .where(
            PatientEvolution.clinic_id == user.clinic_id,
            PatientEvolution.patient_id == patient_id,
        )
        .options(selectinload(PatientEvolution.created_by))
        .order_by(desc(PatientEvolution.date), desc(PatientEvolution.created_at))
    )
    evos = list(result.scalars().all())
    return {"success": True, "data": [_serialize_evo(e) for e in evos]}


@router.post("/{patient_id}/evolutions", status_code=201)
async def create_evolution(
    patient_id: uuid.UUID,
    body: EvolutionCreate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.evolution import PatientEvolution
    evo = PatientEvolution(
        clinic_id=user.clinic_id,
        patient_id=patient_id,
        created_by_id=user.id,
        date=body.date,
        note=body.note,
        attendance=body.attendance,
    )
    db.add(evo)
    await db.flush()
    result = await db.execute(
        select(PatientEvolution)
        .where(PatientEvolution.id == evo.id)
        .options(selectinload(PatientEvolution.created_by))
    )
    evo = result.scalar_one()
    await db.commit()
    return {"success": True, "data": _serialize_evo(evo)}


@router.patch("/{patient_id}/evolutions/{evolution_id}")
async def update_evolution(
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
    body: EvolutionUpdate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    evo = await _get_evo(db, user.clinic_id, patient_id, evolution_id)
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(evo, k, v)
    await db.commit()
    await db.refresh(evo)
    result = await db.execute(
        select(evo.__class__)
        .where(evo.__class__.id == evo.id)
        .options(selectinload(evo.__class__.created_by))
    )
    evo = result.scalar_one()
    return {"success": True, "data": _serialize_evo(evo)}


@router.delete("/{patient_id}/evolutions/{evolution_id}")
async def delete_evolution(
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    evo = await _get_evo(db, user.clinic_id, patient_id, evolution_id)
    await db.delete(evo)
    await db.commit()
    return {"success": True}
