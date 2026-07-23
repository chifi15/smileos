"""
Motor de Planes de Tratamiento y Catálogo de Procedimientos.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.treatment import ProcedureCatalog, TreatmentPlan, TreatmentPlanItem
from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.rewards import RewardsAccount, RewardsTransaction
from app.core.exceptions import NotFoundError, ValidationError
from app.services import rewards_service


# ─── Helpers de carga ─────────────────────────────────────────────────────────

def _plan_load_options():
    return [
        selectinload(TreatmentPlan.items).selectinload(TreatmentPlanItem.procedure),
        selectinload(TreatmentPlan.created_by),
    ]


async def _get_plan(
    db: AsyncSession, clinic_id: uuid.UUID, plan_id: uuid.UUID
) -> TreatmentPlan:
    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id, TreatmentPlan.clinic_id == clinic_id)
        .options(*_plan_load_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise NotFoundError("Plan de tratamiento")
    return plan


async def _get_item(
    db: AsyncSession, clinic_id: uuid.UUID, item_id: uuid.UUID
) -> TreatmentPlanItem:
    result = await db.execute(
        select(TreatmentPlanItem)
        .where(TreatmentPlanItem.id == item_id, TreatmentPlanItem.clinic_id == clinic_id)
        .options(selectinload(TreatmentPlanItem.procedure))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise NotFoundError("Ítem de tratamiento")
    return item


# ─── Catálogo de Procedimientos ───────────────────────────────────────────────

async def list_catalog(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    include_inactive: bool = False,
) -> list[ProcedureCatalog]:
    q = select(ProcedureCatalog).where(ProcedureCatalog.clinic_id == clinic_id)
    if not include_inactive:
        q = q.where(ProcedureCatalog.is_active == True)  # noqa: E712
    q = q.order_by(ProcedureCatalog.category.nullslast(), ProcedureCatalog.name)
    result = await db.execute(q)
    return list(result.scalars().all())


async def get_procedure(
    db: AsyncSession, clinic_id: uuid.UUID, procedure_id: uuid.UUID
) -> ProcedureCatalog:
    result = await db.execute(
        select(ProcedureCatalog).where(
            ProcedureCatalog.id == procedure_id,
            ProcedureCatalog.clinic_id == clinic_id,
        )
    )
    proc = result.scalar_one_or_none()
    if not proc:
        raise NotFoundError("Procedimiento")
    return proc


async def create_procedure(
    db: AsyncSession, clinic_id: uuid.UUID, data: dict
) -> ProcedureCatalog:
    proc = ProcedureCatalog(clinic_id=clinic_id, **data)
    db.add(proc)
    await db.flush()
    return await get_procedure(db, clinic_id, proc.id)


async def update_procedure(
    db: AsyncSession, clinic_id: uuid.UUID, procedure_id: uuid.UUID, data: dict
) -> ProcedureCatalog:
    proc = await get_procedure(db, clinic_id, procedure_id)
    for k, v in data.items():
        setattr(proc, k, v)
    await db.flush()
    return await get_procedure(db, clinic_id, procedure_id)


async def deactivate_procedure(
    db: AsyncSession, clinic_id: uuid.UUID, procedure_id: uuid.UUID
) -> ProcedureCatalog:
    proc = await get_procedure(db, clinic_id, procedure_id)
    proc.is_active = False
    await db.flush()
    return await get_procedure(db, clinic_id, procedure_id)


# ─── Planes de Tratamiento ────────────────────────────────────────────────────

async def list_treatment_plans(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> list[TreatmentPlan]:
    result = await db.execute(
        select(TreatmentPlan)
        .where(
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.patient_id == patient_id,
        )
        .options(*_plan_load_options())
        .order_by(TreatmentPlan.created_at.desc())
    )
    return list(result.scalars().all())


async def create_treatment_plan(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    created_by_id: uuid.UUID,
    data: dict,
) -> TreatmentPlan:
    patient_result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.clinic_id == clinic_id)
    )
    if not patient_result.scalar_one_or_none():
        raise NotFoundError("Paciente")

    plan = TreatmentPlan(
        clinic_id=clinic_id,
        patient_id=patient_id,
        created_by_id=created_by_id,
        **data,
    )
    db.add(plan)
    await db.flush()
    return await _get_plan(db, clinic_id, plan.id)


async def get_treatment_plan(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
) -> TreatmentPlan:
    result = await db.execute(
        select(TreatmentPlan)
        .where(
            TreatmentPlan.id == plan_id,
            TreatmentPlan.clinic_id == clinic_id,
            TreatmentPlan.patient_id == patient_id,
        )
        .options(*_plan_load_options())
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise NotFoundError("Plan de tratamiento")
    return plan


async def delete_treatment_plan(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
) -> None:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    await db.delete(plan)
    await db.flush()


async def update_treatment_plan(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    data: dict,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)

    if plan.status == "completed":
        raise ValidationError("No se puede modificar un plan completado.")

    if data.get("status") == "abandoned" and plan.status != "abandoned":
        plan.abandoned_at = datetime.now(timezone.utc)

    for k, v in data.items():
        setattr(plan, k, v)

    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


# ─── Ítems del Plan ───────────────────────────────────────────────────────────

async def add_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    data: dict,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)

    if plan.status not in ("active", "on_hold"):
        raise ValidationError("Solo se pueden agregar ítems a planes activos o en espera.")

    proc_result = await db.execute(
        select(ProcedureCatalog).where(
            ProcedureCatalog.id == data["procedure_id"],
            ProcedureCatalog.clinic_id == clinic_id,
            ProcedureCatalog.is_active == True,  # noqa: E712
        )
    )
    if not proc_result.scalar_one_or_none():
        raise NotFoundError("Procedimiento")

    item = TreatmentPlanItem(clinic_id=clinic_id, treatment_plan_id=plan_id, **data)
    db.add(item)
    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def update_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    data: dict,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")
    if item.status == "completed":
        raise ValidationError("No se puede modificar un ítem completado.")

    for k, v in data.items():
        setattr(item, k, v)

    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def remove_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")

    await db.delete(item)
    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def start_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")
    if item.status != "pending":
        raise ValidationError(
            f"Solo se pueden iniciar ítems 'pending' (estado actual: {item.status})."
        )

    item.status = "in_progress"
    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def cancel_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")
    if item.status == "completed":
        raise ValidationError("No se puede cancelar un ítem completado.")
    if item.status == "cancelled":
        raise ValidationError("El ítem ya está cancelado.")

    item.status = "cancelled"
    await db.flush()
    await _check_plan_completion(db, plan_id)
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def complete_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
    appointment_id: uuid.UUID | None,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")
    if item.status not in ("pending", "in_progress"):
        raise ValidationError(
            f"Solo se pueden completar ítems 'pending' o 'in_progress' (estado actual: {item.status})."
        )

    if appointment_id is not None:
        appt_result = await db.execute(
            select(Appointment).where(
                Appointment.id == appointment_id,
                Appointment.clinic_id == clinic_id,
                Appointment.patient_id == patient_id,
                Appointment.status.in_(["completed", "in_progress"]),
            )
        )
        if not appt_result.scalar_one_or_none():
            raise ValidationError(
                "La cita indicada no existe o no pertenece a este paciente."
            )

    # Determinar antes de acumular si es el primer tratamiento completado
    is_first = await _is_first_treatment_completion(db, patient_id)

    now = datetime.now(timezone.utc)
    item.status = "completed"
    item.completed_at = now
    item.completed_in_appointment_id = appointment_id
    await db.flush()

    await rewards_service.accrue_treatment_rewards(db, clinic_id, patient_id, appointment_id)

    if is_first:
        patient_result = await db.execute(
            select(Patient).where(Patient.id == patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient and patient.referred_by_patient_id:
            await rewards_service.accrue_referral_rewards(db, patient.referred_by_patient_id)

    await db.flush()
    await _check_plan_completion(db, plan_id)
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


async def reopen_item(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    plan_id: uuid.UUID,
    item_id: uuid.UUID,
) -> TreatmentPlan:
    plan = await get_treatment_plan(db, clinic_id, patient_id, plan_id)
    item = await _get_item(db, clinic_id, item_id)

    if item.treatment_plan_id != plan.id:
        raise NotFoundError("Ítem de tratamiento")
    if item.status not in ("completed", "cancelled"):
        raise ValidationError(
            f"Solo se pueden reabrir ítems completados o cancelados (estado actual: {item.status})."
        )

    item.status = "pending"
    item.completed_at = None
    item.completed_in_appointment_id = None

    if plan.status == "completed":
        plan.status = "active"
        plan.completed_at = None

    await db.flush()
    return await get_treatment_plan(db, clinic_id, patient_id, plan_id)


# ─── Helpers internos ─────────────────────────────────────────────────────────

async def _is_first_treatment_completion(
    db: AsyncSession, patient_id: uuid.UUID
) -> bool:
    """True si este es el primer ítem de tratamiento completado para el paciente."""
    account_result = await db.execute(
        select(RewardsAccount).where(RewardsAccount.patient_id == patient_id)
    )
    account = account_result.scalar_one_or_none()
    if not account:
        return False

    count = await db.scalar(
        select(func.count(RewardsTransaction.id)).where(
            RewardsTransaction.account_id == account.id,
            RewardsTransaction.transaction_type == "treatment_completed",
        )
    ) or 0
    return count == 0


async def _check_plan_completion(db: AsyncSession, plan_id: uuid.UUID) -> None:
    """Auto-completa el plan si todos sus ítems están en estado terminal."""
    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id)
        .options(selectinload(TreatmentPlan.items))
    )
    plan = result.scalar_one_or_none()
    if not plan or plan.status != "active" or not plan.items:
        return

    active = [i for i in plan.items if i.status not in ("completed", "cancelled")]
    if not active:
        plan.status = "completed"
        plan.completed_at = datetime.now(timezone.utc)
