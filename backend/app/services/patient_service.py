import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, update
from sqlalchemy.orm import selectinload

from sqlalchemy import delete as sa_delete

from app.models.patient import Patient
from app.models.rewards import RewardsAccount, RewardsTransaction
from app.models.odontogram import OdontogramTooth, OdontogramSnapshot, TreatmentQuote
from app.models.treatment import TreatmentPlan, TreatmentPlanItem
from app.models.appointment import Appointment
from app.models.clinical_record import ClinicalRecord
from app.models.finance import FinanceTransaction
from app.schemas.patient import PatientCreate, PatientUpdate
from app.core.exceptions import NotFoundError, ConflictError


async def create_patient(
    db: AsyncSession, clinic_id: uuid.UUID, data: PatientCreate
) -> Patient:
    max_num = await db.scalar(
        select(func.max(Patient.patient_number)).where(Patient.clinic_id == clinic_id)
    )
    next_number = (max_num or 0) + 1

    patient = Patient(
        clinic_id=clinic_id,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        id_number=data.id_number,
        phone=data.phone,
        phone_secondary=data.phone_secondary,
        email=data.email,
        address=data.address,
        city=data.city,
        country=data.country,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone,
        blood_type=data.blood_type,
        allergies=data.allergies,
        medical_conditions=data.medical_conditions,
        current_medications=data.current_medications,
        chief_complaint=data.chief_complaint,
        referred_by_patient_id=data.referred_by_patient_id,
        patient_number=next_number,
        notes=data.notes,
    )
    db.add(patient)
    await db.flush()

    db.add(RewardsAccount(
        clinic_id=clinic_id,
        patient_id=patient.id,
        total_points=0,
        level="starter",
    ))
    await db.flush()

    # Re-fetch con relaciones cargadas para evitar lazy-load en contexto async
    return await get_patient(db, clinic_id, patient.id)


async def get_patient(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> Patient:
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundError("Paciente")
    return patient


async def list_patients(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    search: str | None = None,
    level: str | None = None,
    active_only: bool = True,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[Patient], int]:
    base = (
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.clinic_id == clinic_id)
    )

    if active_only:
        base = base.where(Patient.is_active == True)

    if search:
        term = f"%{search.strip().lower()}%"
        base = base.where(
            or_(
                func.lower(Patient.first_name + " " + Patient.last_name).like(term),
                Patient.phone.like(term),
                func.lower(Patient.email).like(term),
                Patient.id_number.like(term),
            )
        )

    if level:
        base = base.join(RewardsAccount, Patient.id == RewardsAccount.patient_id).where(
            RewardsAccount.level == level
        )

    # Contar total antes de paginar
    count_q = select(func.count()).select_from(base.subquery())
    total: int = await db.scalar(count_q) or 0

    # Ordenar y paginar
    base = base.order_by(Patient.first_name, Patient.last_name)
    base = base.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(base)
    patients = list(result.scalars().all())

    return patients, total


async def update_patient(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    data: PatientUpdate,
) -> Patient:
    patient = await get_patient(db, clinic_id, patient_id)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    await db.flush()
    # Re-fetch para obtener timestamps actualizados y relaciones cargadas
    return await get_patient(db, clinic_id, patient_id)


async def set_referral(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    referrer_patient_id: uuid.UUID | None,
) -> tuple[Patient, bool]:
    """
    Asigna o limpia el referidor del paciente.
    Retorna (patient_actualizado, puntos_otorgados).
    Los puntos se otorgan solo si es la primera vez (referred_by_patient_id era None).
    """
    from app.core.exceptions import ValidationError
    from app.services import rewards_service

    if referrer_patient_id is not None and referrer_patient_id == patient_id:
        raise ValidationError("Un paciente no puede referirse a sí mismo.")

    patient = await get_patient(db, clinic_id, patient_id)
    was_none = patient.referred_by_patient_id is None
    is_new_referrer = referrer_patient_id != patient.referred_by_patient_id

    if not is_new_referrer:
        return patient, False

    # Validar que el referidor pertenece a la misma clínica
    if referrer_patient_id is not None:
        referrer = await db.execute(
            select(Patient).where(
                Patient.id == referrer_patient_id,
                Patient.clinic_id == clinic_id,
                Patient.is_active == True,  # noqa: E712
            )
        )
        if not referrer.scalar_one_or_none():
            raise ValidationError("El paciente referidor no existe o no está activo.")

    patient.referred_by_patient_id = referrer_patient_id
    await db.flush()

    # Solo otorgamos puntos si es la primera asignación
    points_awarded = False
    if referrer_patient_id is not None and was_none:
        await rewards_service.grant_referral_bonus(db, clinic_id, referrer_patient_id)
        points_awarded = True

    return await get_patient(db, clinic_id, patient_id), points_awarded


async def deactivate_patient(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> None:
    patient = await get_patient(db, clinic_id, patient_id)
    patient.is_active = False
    await db.flush()


async def delete_patient_permanent(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> None:
    """Elimina el paciente y todos sus registros vinculados en orden seguro."""
    patient = await get_patient(db, clinic_id, patient_id)

    # 1. TreatmentPlanItems → TreatmentPlans
    plan_ids_q = select(TreatmentPlan.id).where(TreatmentPlan.patient_id == patient_id)
    await db.execute(sa_delete(TreatmentPlanItem).where(TreatmentPlanItem.treatment_plan_id.in_(plan_ids_q)))
    await db.execute(sa_delete(TreatmentPlan).where(TreatmentPlan.patient_id == patient_id))

    # 2. Odontograma
    await db.execute(sa_delete(OdontogramTooth).where(OdontogramTooth.patient_id == patient_id))
    await db.execute(sa_delete(OdontogramSnapshot).where(OdontogramSnapshot.patient_id == patient_id))
    await db.execute(sa_delete(TreatmentQuote).where(TreatmentQuote.patient_id == patient_id))

    # 3. Citas
    await db.execute(sa_delete(Appointment).where(Appointment.patient_id == patient_id))

    # 4. Historia clínica
    await db.execute(sa_delete(ClinicalRecord).where(ClinicalRecord.patient_id == patient_id))

    # 5. Rewards: transacciones → cuenta
    account_ids_q = select(RewardsAccount.id).where(RewardsAccount.patient_id == patient_id)
    await db.execute(sa_delete(RewardsTransaction).where(RewardsTransaction.account_id.in_(account_ids_q)))
    await db.execute(sa_delete(RewardsAccount).where(RewardsAccount.patient_id == patient_id))

    # 6. Finanzas: desvincular (no eliminar registros financieros)
    await db.execute(
        update(FinanceTransaction)
        .where(FinanceTransaction.patient_id == patient_id)
        .values(patient_id=None)
    )

    # 7. Quitar referencia de otros pacientes que fueron referidos por este
    await db.execute(
        update(Patient)
        .where(Patient.referred_by_patient_id == patient_id)
        .values(referred_by_patient_id=None)
    )

    # 8. Paciente
    await db.delete(patient)
    await db.flush()


async def search_patients_simple(
    db: AsyncSession, clinic_id: uuid.UUID, q: str, limit: int = 10
) -> list[Patient]:
    """Búsqueda rápida para autocompletar. Si q está vacío retorna los más recientes."""
    base_q = (
        select(Patient)
        .options(selectinload(Patient.rewards_account))
        .where(Patient.clinic_id == clinic_id, Patient.is_active == True)
    )
    if q.strip():
        term = f"%{q.strip().lower()}%"
        base_q = base_q.where(
            or_(
                func.lower(Patient.first_name + " " + Patient.last_name).like(term),
                Patient.phone.like(term),
            )
        ).order_by(Patient.first_name, Patient.last_name)
    else:
        base_q = base_q.order_by(Patient.created_at.desc())
    result = await db.execute(base_q.limit(limit))
    return list(result.scalars().all())
