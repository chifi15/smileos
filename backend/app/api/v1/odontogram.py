import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.services import odontogram_service

router = APIRouter(
    prefix="/patients/{patient_id}/odontogram",
    tags=["Odontograma"],
)


def _serialize_tooth(t) -> dict:
    return {
        "id": str(t.id),
        "tooth_number": t.tooth_number,
        "condition": t.condition,
        "notes": t.notes,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "updated_by": {"id": str(t.updated_by.id), "full_name": t.updated_by.full_name}
        if t.updated_by else None,
    }


def _serialize_snapshot(s) -> dict:
    return {
        "id": str(s.id),
        "created_at": s.created_at.isoformat(),
        "snapshot_notes": s.snapshot_notes,
        "teeth_data": s.teeth_data,
        "created_by": {"id": str(s.created_by.id), "full_name": s.created_by.full_name}
        if s.created_by else None,
    }


class ToothUpdate(BaseModel):
    condition: str | None = None
    notes: str | None = None


class OdontogramUpdate(BaseModel):
    teeth: dict[int, ToothUpdate]
    snapshot_notes: str | None = None
    kind: str = "inicial"


@router.get("")
async def get_odontogram(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str = Query(default="inicial"),
):
    teeth = await odontogram_service.get_odontogram(db, user.clinic_id, patient_id, kind)
    return {"success": True, "data": [_serialize_tooth(t) for t in teeth]}


@router.patch("")
async def update_odontogram(
    patient_id: uuid.UUID,
    body: OdontogramUpdate,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    updates = {num: data.model_dump(exclude_none=True) for num, data in body.teeth.items()}
    teeth = await odontogram_service.update_odontogram(
        db, user.clinic_id, patient_id, user.id, updates, body.snapshot_notes, body.kind
    )
    await db.commit()
    return {"success": True, "data": [_serialize_tooth(t) for t in teeth]}


@router.get("/snapshots")
async def list_snapshots(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str = Query(default="inicial"),
):
    snaps = await odontogram_service.list_snapshots(db, user.clinic_id, patient_id, kind)
    return {"success": True, "data": [_serialize_snapshot(s) for s in snaps]}


@router.get("/snapshots/{snapshot_id}")
async def get_snapshot(
    patient_id: uuid.UUID,
    snapshot_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    kind: str = Query(default="inicial"),
):
    snap = await odontogram_service.get_snapshot(db, user.clinic_id, patient_id, snapshot_id, kind)
    return {"success": True, "data": _serialize_snapshot(snap)}


@router.post("/copy-to-tratamiento")
async def copy_inicial_to_tratamiento(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Overwrites all 'tratamiento' teeth with the current state of 'inicial' teeth."""
    from sqlalchemy import delete as sa_delete
    from app.models.odontogram import OdontogramTooth as OT

    # Fetch inicial teeth
    r = await db.execute(
        select(OT).where(
            OT.clinic_id == user.clinic_id,
            OT.patient_id == patient_id,
            OT.kind == "inicial",
        )
    )
    inicial = r.scalars().all()

    # Delete existing tratamiento teeth
    await db.execute(
        sa_delete(OT).where(
            OT.clinic_id == user.clinic_id,
            OT.patient_id == patient_id,
            OT.kind == "tratamiento",
        )
    )
    await db.flush()

    # Re-create from inicial
    now = datetime.now(timezone.utc)
    for t in inicial:
        db.add(OT(
            clinic_id=user.clinic_id,
            patient_id=patient_id,
            kind="tratamiento",
            tooth_number=t.tooth_number,
            condition=t.condition,
            notes=t.notes,
            updated_at=now,
            updated_by_id=user.id,
        ))

    await db.commit()

    teeth = await odontogram_service.get_odontogram(db, user.clinic_id, patient_id, "tratamiento")
    return {"success": True, "data": [_serialize_tooth(t) for t in teeth]}


# ─── Cotización ───────────────────────────────────────────────────────────────

quote_router = APIRouter(
    prefix="/patients/{patient_id}/treatment-quote",
    tags=["Cotización"],
)


class QuoteSaveBody(BaseModel):
    items: list[dict]


@quote_router.get("")
async def get_quote(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.odontogram import TreatmentQuote  # local import avoids circular
    result = await db.execute(
        select(TreatmentQuote).where(
            TreatmentQuote.clinic_id == user.clinic_id,
            TreatmentQuote.patient_id == patient_id,
        )
    )
    quote = result.scalar_one_or_none()
    return {"success": True, "data": quote.items if quote else []}


@quote_router.put("")
async def save_quote(
    patient_id: uuid.UUID,
    body: QuoteSaveBody,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from app.models.odontogram import TreatmentQuote
    result = await db.execute(
        select(TreatmentQuote).where(
            TreatmentQuote.clinic_id == user.clinic_id,
            TreatmentQuote.patient_id == patient_id,
        )
    )
    quote = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if quote:
        quote.items = body.items
        quote.updated_at = now
        quote.updated_by_id = user.id
    else:
        quote = TreatmentQuote(
            clinic_id=user.clinic_id,
            patient_id=patient_id,
            items=body.items,
            updated_at=now,
            updated_by_id=user.id,
        )
        db.add(quote)
    await db.commit()
    return {"success": True, "data": quote.items}
