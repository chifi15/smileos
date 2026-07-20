import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.treatment import ProcedureCreate, ProcedureUpdate
from app.services import treatment_service

router = APIRouter(prefix="/catalog/procedures", tags=["Catálogo de Procedimientos"])


def _serialize(p) -> dict:
    return {
        "id": str(p.id),
        "clinic_id": str(p.clinic_id),
        "name": p.name,
        "code": p.code,
        "description": p.description,
        "default_duration_minutes": p.default_duration_minutes,
        "default_price": float(p.default_price) if p.default_price is not None else None,
        "operational_cost": float(p.operational_cost) if p.operational_cost is not None else None,
        "category": p.category,
        "is_active": p.is_active,
        "is_system": p.is_system,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
async def list_procedures(
    user: Annotated[object, require_permission("view_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: bool = Query(default=False),
):
    procs = await treatment_service.list_catalog(db, user.clinic_id, include_inactive)
    return {"success": True, "data": [_serialize(p) for p in procs]}


@router.post("", status_code=201)
async def create_procedure(
    body: ProcedureCreate,
    user: Annotated[object, require_permission("manage_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    proc = await treatment_service.create_procedure(db, user.clinic_id, body.model_dump())
    return {"success": True, "data": _serialize(proc)}


@router.get("/{procedure_id}")
async def get_procedure(
    procedure_id: uuid.UUID,
    user: Annotated[object, require_permission("view_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    proc = await treatment_service.get_procedure(db, user.clinic_id, procedure_id)
    return {"success": True, "data": _serialize(proc)}


@router.patch("/{procedure_id}")
async def update_procedure(
    procedure_id: uuid.UUID,
    body: ProcedureUpdate,
    user: Annotated[object, require_permission("manage_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    proc = await treatment_service.update_procedure(db, user.clinic_id, procedure_id, data)
    return {"success": True, "data": _serialize(proc)}


@router.delete("/{procedure_id}")
async def deactivate_procedure(
    procedure_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    proc = await treatment_service.deactivate_procedure(db, user.clinic_id, procedure_id)
    return {"success": True, "data": _serialize(proc)}
