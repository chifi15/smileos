import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.evolution import EvolutionCreate, EvolutionUpdate
from app.services import evolution_service

router = APIRouter(
    prefix="/patients/{patient_id}/evolutions",
    tags=["Evolución Clínica"],
)


def _serialize(evo) -> dict:
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


@router.get("")
async def list_evolutions(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    evos = await evolution_service.list_evolutions(db, user.clinic_id, patient_id)
    return {"success": True, "data": [_serialize(e) for e in evos]}


@router.post("", status_code=201)
async def create_evolution(
    patient_id: uuid.UUID,
    body: EvolutionCreate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    evo = await evolution_service.create_evolution(
        db, user.clinic_id, patient_id, user.id, body.model_dump()
    )
    return {"success": True, "data": _serialize(evo)}


@router.patch("/{evolution_id}")
async def update_evolution(
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
    body: EvolutionUpdate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    evo = await evolution_service.update_evolution(
        db, user.clinic_id, patient_id, evolution_id, data
    )
    return {"success": True, "data": _serialize(evo)}


@router.delete("/{evolution_id}", status_code=200)
async def delete_evolution(
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await evolution_service.delete_evolution(
        db, user.clinic_id, patient_id, evolution_id
    )
    return {"success": True}
