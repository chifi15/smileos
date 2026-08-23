import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.treatment import ProcedureCreate, ProcedureUpdate
from app.services import treatment_service, audit_service

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
        "sort_order": p.sort_order,
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

    # Capture old values before update
    old = await treatment_service.get_procedure(db, user.clinic_id, procedure_id)
    old_name = old.name
    old_price = float(old.default_price) if old.default_price is not None else None
    old_op_cost = float(old.operational_cost) if old.operational_cost is not None else None

    proc = await treatment_service.update_procedure(db, user.clinic_id, procedure_id, data)

    # Build diff — only log price/name changes (not duration, category, etc.)
    changes: dict = {"procedure_name": proc.name}
    parts: list[str] = []

    if "name" in data and data["name"] != old_name:
        changes["name_from"] = old_name
        changes["name_to"] = proc.name
        parts.append(f"renombrado '{old_name}' → '{proc.name}'")

    new_price = float(proc.default_price) if proc.default_price is not None else None
    if "default_price" in data and new_price != old_price:
        changes["price_from"] = old_price
        changes["price_to"] = new_price
        old_str = f"C$ {old_price:,.2f}" if old_price is not None else "sin precio"
        new_str = f"C$ {new_price:,.2f}" if new_price is not None else "sin precio"
        parts.append(f"precio {old_str} → {new_str}")

    new_op = float(proc.operational_cost) if proc.operational_cost is not None else None
    if "operational_cost" in data and new_op != old_op_cost:
        changes["operational_cost_from"] = old_op_cost
        changes["operational_cost_to"] = new_op
        old_str = f"C$ {old_op_cost:,.2f}" if old_op_cost is not None else "sin costo"
        new_str = f"C$ {new_op:,.2f}" if new_op is not None else "sin costo"
        parts.append(f"costo op. {old_str} → {new_str}")

    if parts:
        description = f"{proc.name}: {', '.join(parts)}"
        await audit_service.log(
            db, clinic_id=user.clinic_id, user_id=user.id,
            action="procedure_catalog.updated",
            resource_type="procedure_catalog",
            resource_id=str(procedure_id),
            description=description,
            metadata=changes,
        )

    return {"success": True, "data": _serialize(proc)}


class ReorderBody(BaseModel):
    ids: list[str]


@router.put("/reorder")
async def reorder_procedures(
    body: ReorderBody,
    user: Annotated[object, require_permission("manage_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    ids = [uuid.UUID(i) for i in body.ids]
    await treatment_service.reorder_procedures(db, user.clinic_id, ids)
    return {"success": True}


@router.delete("/{procedure_id}")
async def deactivate_procedure(
    procedure_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_catalog")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    proc = await treatment_service.deactivate_procedure(db, user.clinic_id, procedure_id)
    return {"success": True, "data": _serialize(proc)}
