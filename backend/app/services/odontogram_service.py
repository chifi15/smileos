import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.odontogram import OdontogramTooth, OdontogramSnapshot, ADULT_TEETH
from app.models.patient import Patient
from app.core.exceptions import NotFoundError


async def _verify_patient(db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Patient.id).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundError("Paciente")


async def get_odontogram(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, kind: str = "inicial"
) -> list[OdontogramTooth]:
    """Devuelve el estado actual de todas las piezas para el kind dado. Crea filas 'sano' para las que no existan."""
    await _verify_patient(db, clinic_id, patient_id)

    result = await db.execute(
        select(OdontogramTooth)
        .where(
            OdontogramTooth.clinic_id == clinic_id,
            OdontogramTooth.patient_id == patient_id,
            OdontogramTooth.kind == kind,
        )
        .options(selectinload(OdontogramTooth.updated_by))
    )
    existing = {t.tooth_number: t for t in result.scalars().all()}

    # When creating "tratamiento" teeth for the first time, copy from "inicial"
    source_map: dict[int, OdontogramTooth] = {}
    if kind == "tratamiento" and not existing:
        r = await db.execute(
            select(OdontogramTooth).where(
                OdontogramTooth.clinic_id == clinic_id,
                OdontogramTooth.patient_id == patient_id,
                OdontogramTooth.kind == "inicial",
            )
        )
        source_map = {t.tooth_number: t for t in r.scalars().all()}

    for num in ADULT_TEETH:
        if num not in existing:
            src = source_map.get(num)
            tooth = OdontogramTooth(
                clinic_id=clinic_id,
                patient_id=patient_id,
                kind=kind,
                tooth_number=num,
                condition=src.condition if src else "sano",
                notes=src.notes if src else None,
            )
            db.add(tooth)
            existing[num] = tooth

    await db.flush()
    result2 = await db.execute(
        select(OdontogramTooth)
        .where(
            OdontogramTooth.clinic_id == clinic_id,
            OdontogramTooth.patient_id == patient_id,
            OdontogramTooth.kind == kind,
        )
        .options(selectinload(OdontogramTooth.updated_by))
        .order_by(OdontogramTooth.tooth_number)
    )
    return result2.scalars().all()


async def update_odontogram(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    user_id: uuid.UUID,
    updates: dict[int, dict],
    snapshot_notes: str | None,
    kind: str = "inicial",
) -> list[OdontogramTooth]:
    """Actualiza las piezas indicadas y guarda un snapshot del estado completo."""
    teeth = await get_odontogram(db, clinic_id, patient_id, kind)
    tooth_map = {t.tooth_number: t for t in teeth}

    now = datetime.now(timezone.utc)
    for num, data in updates.items():
        tooth = tooth_map.get(num)
        if not tooth:
            continue
        if "condition" in data:
            tooth.condition = data["condition"]
        if "notes" in data:
            tooth.notes = data["notes"] or None
        tooth.updated_at = now
        tooth.updated_by_id = user_id

    await db.flush()

    snapshot_data = {
        str(t.tooth_number): {"condition": t.condition, "notes": t.notes}
        for t in tooth_map.values()
    }
    snapshot = OdontogramSnapshot(
        clinic_id=clinic_id,
        patient_id=patient_id,
        kind=kind,
        teeth_data=snapshot_data,
        snapshot_notes=snapshot_notes,
        created_at=now,
        created_by_id=user_id,
    )
    db.add(snapshot)
    await db.flush()

    return teeth


async def list_snapshots(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, kind: str = "inicial"
) -> list[OdontogramSnapshot]:
    await _verify_patient(db, clinic_id, patient_id)
    result = await db.execute(
        select(OdontogramSnapshot)
        .where(
            OdontogramSnapshot.clinic_id == clinic_id,
            OdontogramSnapshot.patient_id == patient_id,
            OdontogramSnapshot.kind == kind,
        )
        .options(selectinload(OdontogramSnapshot.created_by))
        .order_by(OdontogramSnapshot.created_at.desc())
    )
    return result.scalars().all()


async def get_snapshot(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID, snapshot_id: uuid.UUID, kind: str = "inicial"
) -> OdontogramSnapshot:
    await _verify_patient(db, clinic_id, patient_id)
    result = await db.execute(
        select(OdontogramSnapshot)
        .where(
            OdontogramSnapshot.id == snapshot_id,
            OdontogramSnapshot.clinic_id == clinic_id,
            OdontogramSnapshot.patient_id == patient_id,
        )
        .options(selectinload(OdontogramSnapshot.created_by))
    )
    snap = result.scalar_one_or_none()
    if not snap:
        raise NotFoundError("Snapshot")
    return snap
