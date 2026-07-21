import uuid
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.evolution import PatientEvolution
from app.models.patient import Patient
from app.core.exceptions import NotFoundError


async def _check_patient(db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundError("Paciente")


async def list_evolutions(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> list[PatientEvolution]:
    await _check_patient(db, clinic_id, patient_id)
    result = await db.execute(
        select(PatientEvolution)
        .where(
            PatientEvolution.clinic_id == clinic_id,
            PatientEvolution.patient_id == patient_id,
        )
        .options(selectinload(PatientEvolution.created_by))
        .order_by(desc(PatientEvolution.date), desc(PatientEvolution.created_at))
    )
    return list(result.scalars().all())


async def create_evolution(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    created_by_id: uuid.UUID,
    data: dict,
) -> PatientEvolution:
    await _check_patient(db, clinic_id, patient_id)
    evo = PatientEvolution(
        clinic_id=clinic_id,
        patient_id=patient_id,
        created_by_id=created_by_id,
        **data,
    )
    db.add(evo)
    await db.flush()
    # Re-query to eager-load the relationship
    result = await db.execute(
        select(PatientEvolution)
        .where(PatientEvolution.id == evo.id)
        .options(selectinload(PatientEvolution.created_by))
    )
    return result.scalar_one()


async def update_evolution(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
    data: dict,
) -> PatientEvolution:
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
        raise NotFoundError("Nota de evolución")
    for k, v in data.items():
        setattr(evo, k, v)
    await db.flush()
    return evo


async def delete_evolution(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    evolution_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(PatientEvolution).where(
            PatientEvolution.id == evolution_id,
            PatientEvolution.clinic_id == clinic_id,
            PatientEvolution.patient_id == patient_id,
        )
    )
    evo = result.scalar_one_or_none()
    if not evo:
        raise NotFoundError("Nota de evolución")
    await db.delete(evo)
    await db.flush()
