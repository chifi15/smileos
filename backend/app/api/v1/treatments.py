import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.treatment import (
    TreatmentPlanCreate,
    TreatmentPlanUpdate,
    TreatmentItemCreate,
    TreatmentItemUpdate,
    CompleteItemRequest,
)
from app.services import treatment_service

router = APIRouter(
    prefix="/patients/{patient_id}/treatment-plans",
    tags=["Planes de Tratamiento"],
)


def _iso(dt):
    return dt.isoformat() if dt else None


def _serialize_item(item) -> dict:
    return {
        "id": str(item.id),
        "procedure_id": str(item.procedure_id),
        "procedure_name": item.procedure.name if item.procedure else None,
        "procedure_code": item.procedure.code if item.procedure else None,
        "status": item.status,
        "priority": item.priority,
        "tooth_fdi": item.tooth_fdi,
        "notes": item.notes,
        "quoted_price": float(item.quoted_price) if item.quoted_price is not None else None,
        "sort_order": item.sort_order,
        "completed_at": _iso(item.completed_at),
        "completed_in_appointment_id": (
            str(item.completed_in_appointment_id)
            if item.completed_in_appointment_id
            else None
        ),
        "created_at": _iso(item.created_at),
    }


def _serialize_plan(plan) -> dict:
    return {
        "id": str(plan.id),
        "patient_id": str(plan.patient_id),
        "created_by": {
            "id": str(plan.created_by.id),
            "full_name": plan.created_by.full_name,
        } if plan.created_by else None,
        "title": plan.title,
        "diagnosis": plan.diagnosis,
        "status": plan.status,
        "notes": plan.notes,
        "abandoned_reason": plan.abandoned_reason,
        "completed_at": _iso(plan.completed_at),
        "abandoned_at": _iso(plan.abandoned_at),
        "created_at": _iso(plan.created_at),
        "updated_at": _iso(plan.updated_at),
        "items": [_serialize_item(i) for i in plan.items],
    }


# ─── Planes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_plans(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plans = await treatment_service.list_treatment_plans(db, user.clinic_id, patient_id)
    return {"success": True, "data": [_serialize_plan(p) for p in plans]}


@router.post("", status_code=201)
async def create_plan(
    patient_id: uuid.UUID,
    body: TreatmentPlanCreate,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.create_treatment_plan(
        db, user.clinic_id, patient_id, user.id, body.model_dump()
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.get("/{plan_id}")
async def get_plan(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    user: Annotated[object, require_permission("view_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.get_treatment_plan(db, user.clinic_id, patient_id, plan_id)
    return {"success": True, "data": _serialize_plan(plan)}


@router.patch("/{plan_id}")
async def update_plan(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    body: TreatmentPlanUpdate,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    plan = await treatment_service.update_treatment_plan(
        db, user.clinic_id, patient_id, plan_id, data
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.delete("/{plan_id}", status_code=200)
async def delete_plan(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await treatment_service.delete_treatment_plan(db, user.clinic_id, patient_id, plan_id)
    return {"success": True}


# ─── Ítems ────────────────────────────────────────────────────────────────────

@router.post("/{plan_id}/items", status_code=201)
async def add_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    body: TreatmentItemCreate,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.add_item(
        db, user.clinic_id, patient_id, plan_id, body.model_dump()
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.patch("/{plan_id}/items/{item_id}")
async def update_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    body: TreatmentItemUpdate,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    plan = await treatment_service.update_item(
        db, user.clinic_id, patient_id, plan_id, item_id, data
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.delete("/{plan_id}/items/{item_id}")
async def remove_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.remove_item(
        db, user.clinic_id, patient_id, plan_id, item_id
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.post("/{plan_id}/items/{item_id}/start")
async def start_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.start_item(
        db, user.clinic_id, patient_id, plan_id, item_id
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.post("/{plan_id}/items/{item_id}/cancel")
async def cancel_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.cancel_item(
        db, user.clinic_id, patient_id, plan_id, item_id
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.post("/{plan_id}/items/{item_id}/reopen")
async def reopen_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.reopen_item(
        db, user.clinic_id, patient_id, plan_id, item_id
    )
    return {"success": True, "data": _serialize_plan(plan)}


@router.post("/{plan_id}/items/{item_id}/complete")
async def complete_item(
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    body: CompleteItemRequest,
    user: Annotated[object, require_permission("manage_treatments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    plan = await treatment_service.complete_item(
        db, user.clinic_id, patient_id, plan_id, item_id, body.appointment_id
    )
    return {"success": True, "data": _serialize_plan(plan)}
