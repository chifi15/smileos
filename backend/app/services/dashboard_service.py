"""
Servicio de Dashboard — agrega KPIs en tiempo real desde la base de datos.
Todas las consultas están aisladas por clinic_id; sin caché por ahora (v0.1).
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

logger = logging.getLogger("smileos")

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, cast, Date, extract
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.treatment import TreatmentPlan
from app.models.rewards import RewardsAccount
from app.models.finance import FinanceTransaction

CLINIC_TZ = ZoneInfo("America/Managua")


def _today_range_utc() -> tuple[datetime, datetime]:
    """Medianoche a medianoche en zona horaria de la clínica, convertido a UTC."""
    now_local = datetime.now(CLINIC_TZ)
    day_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end_local = day_start_local + timedelta(days=1)
    return day_start_local.astimezone(timezone.utc), day_end_local.astimezone(timezone.utc)


def _month_start_utc() -> datetime:
    now_local = datetime.now(CLINIC_TZ)
    month_start_local = now_local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return month_start_local.astimezone(timezone.utc)


async def get_today_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Desglose de citas del día por estado."""
    day_start, day_end = _today_range_utc()

    rows = await db.execute(
        select(
            Appointment.status,
            func.count(Appointment.id).label("count"),
        )
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at < day_end,
        )
        .group_by(Appointment.status)
    )

    counts = {row.status: row.count for row in rows}
    total = sum(counts.values())
    return {
        "total": total,
        "scheduled": counts.get("scheduled", 0),
        "confirmed": counts.get("confirmed", 0),
        "in_progress": counts.get("in_progress", 0),
        "completed": counts.get("completed", 0),
        "no_show": counts.get("no_show", 0),
        "cancelled": counts.get("cancelled", 0),
    }


async def get_weekly_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Citas completadas y nuevos pacientes en los últimos 7 días."""
    week_start = datetime.now(timezone.utc) - timedelta(days=7)

    completed = await db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic_id,
            Appointment.status == "completed",
            Appointment.completed_at >= week_start,
        )
    ) or 0

    new_patients = await db.scalar(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= week_start,
        )
    ) or 0

    return {
        "completed_appointments": completed,
        "new_patients": new_patients,
    }


async def get_patient_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Total de pacientes activos y nuevos del mes en curso."""
    month_start = _month_start_utc()

    total_active = await db.scalar(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.is_active == True,  # noqa: E712
        )
    ) or 0

    new_this_month = await db.scalar(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= month_start,
        )
    ) or 0

    return {
        "total_active": total_active,
        "new_this_month": new_this_month,
    }


async def get_monthly_patient_transactions(
    db: AsyncSession, clinic_id: uuid.UUID
) -> list[dict]:
    """Transacciones de ingreso del mes actual vinculadas a un paciente."""
    now_local = datetime.now(CLINIC_TZ)
    current_year = now_local.year
    current_month = now_local.month

    result = await db.execute(
        select(FinanceTransaction)
        .where(
            FinanceTransaction.clinic_id == clinic_id,
            FinanceTransaction.type == "ingreso",
            FinanceTransaction.patient_id.isnot(None),
            extract("year", FinanceTransaction.transaction_date) == current_year,
            extract("month", FinanceTransaction.transaction_date) == current_month,
        )
        .options(
            selectinload(FinanceTransaction.patient),
            selectinload(FinanceTransaction.doctor),
            selectinload(FinanceTransaction.procedure),
        )
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
    )
    txs = list(result.scalars().all())

    rows = []
    for tx in txs:
        patient = tx.patient
        doctor = tx.doctor
        procedure = tx.procedure
        rows.append({
            "transaction_id": str(tx.id),
            "date": tx.transaction_date.isoformat()[:10],
            "patient_id": str(patient.id) if patient else None,
            "patient_name": patient.full_name if patient else tx.description,
            "procedure_name": procedure.name if procedure else None,
            "doctor_name": doctor.full_name if doctor else None,
            "amount": float(tx.amount_cordobas),
            "description": tx.description,
        })
    return rows


async def get_monthly_appointment_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Ingresos del mes actual y pacientes únicos atendidos según finanzas."""
    now_local = datetime.now(ZoneInfo("America/Managua"))
    current_year = now_local.year
    current_month = now_local.month

    base_filters = [
        FinanceTransaction.clinic_id == clinic_id,
        FinanceTransaction.type == "ingreso",
        extract("year", FinanceTransaction.transaction_date) == current_year,
        extract("month", FinanceTransaction.transaction_date) == current_month,
    ]

    patient_filter = FinanceTransaction.patient_id.isnot(None)

    total_citas = await db.scalar(
        select(func.count(FinanceTransaction.id)).where(*base_filters, patient_filter)
    ) or 0

    pacientes_unicos = await db.scalar(
        select(func.count(func.distinct(FinanceTransaction.patient_id))).where(
            *base_filters, patient_filter,
        )
    ) or 0

    return {
        "total_citas_mes": total_citas,
        "pacientes_unicos_mes": pacientes_unicos,
    }


async def get_new_patients_by_month(
    db: AsyncSession, clinic_id: uuid.UUID, months: int = 12
) -> list[dict]:
    """Nuevos pacientes (primera visita) agrupados por mes, últimos N meses."""
    now_local = datetime.now(CLINIC_TZ)

    # Calcular inicio de la ventana
    m, y = now_local.month, now_local.year
    for _ in range(months - 1):
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    window_start_local = now_local.replace(
        year=y, month=m, day=1, hour=0, minute=0, second=0, microsecond=0
    )
    window_start_utc = window_start_local.astimezone(timezone.utc)

    # Subconsulta: fecha mínima de cita por paciente (ignorando canceladas)
    first_appt_subq = (
        select(
            Appointment.patient_id.label("patient_id"),
            func.min(Appointment.scheduled_at).label("first_at"),
        )
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.status.not_in(["cancelled"]),
        )
        .group_by(Appointment.patient_id)
        .subquery()
    )

    stmt = (
        select(
            Patient.id,
            Patient.full_name,
            Patient.phone,
            first_appt_subq.c.first_at,
            Appointment.appointment_type,
        )
        .join(first_appt_subq, Patient.id == first_appt_subq.c.patient_id)
        .join(
            Appointment,
            and_(
                Appointment.patient_id == first_appt_subq.c.patient_id,
                Appointment.scheduled_at == first_appt_subq.c.first_at,
                Appointment.clinic_id == clinic_id,
                Appointment.status.not_in(["cancelled"]),
            ),
        )
        .where(
            Patient.clinic_id == clinic_id,
            first_appt_subq.c.first_at >= window_start_utc,
        )
        .order_by(first_appt_subq.c.first_at)
    )
    rows = (await db.execute(stmt)).all()

    # Agrupar por año/mes (deduplicar por si hay citas con exactamente el mismo scheduled_at)
    by_month: dict[tuple[int, int], list] = {}
    seen_patients: set = set()
    for row in rows:
        if row.id in seen_patients:
            continue
        seen_patients.add(row.id)
        local_dt = row.first_at.astimezone(CLINIC_TZ)
        key = (local_dt.year, local_dt.month)
        if key not in by_month:
            by_month[key] = []
        by_month[key].append({
            "patient_id": str(row.id),
            "patient_name": row.full_name,
            "phone": row.phone,
            "first_appointment_date": local_dt.date().isoformat(),
            "appointment_type": row.appointment_type,
        })

    # Construir lista de N meses más reciente primero, incluir meses sin pacientes
    result = []
    cy, cm = now_local.year, now_local.month
    for _ in range(months):
        patients_in_month = by_month.get((cy, cm), [])
        result.append({
            "year": cy,
            "month": cm,
            "count": len(patients_in_month),
            "patients": patients_in_month,
        })
        cm -= 1
        if cm == 0:
            cm = 12
            cy -= 1
    return result


async def get_new_patients_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Pacientes con primera visita este mes (sin ninguna cita anterior)."""
    month_start = _month_start_utc()

    previous_patients_subq = (
        select(func.distinct(Appointment.patient_id))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at < month_start,
        )
        .scalar_subquery()
    )

    new_count = await db.scalar(
        select(func.count(func.distinct(Appointment.patient_id)))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at >= month_start,
            Appointment.status.not_in(["cancelled"]),
            Appointment.patient_id.not_in(previous_patients_subq),
        )
    ) or 0

    return {"pacientes_nuevos_mes": new_count}


async def get_new_patients_list(db: AsyncSession, clinic_id: uuid.UUID) -> list[dict]:
    """Lista de pacientes con primera visita este mes para el modal del dashboard."""
    month_start = _month_start_utc()

    previous_patients_subq = (
        select(func.distinct(Appointment.patient_id))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at < month_start,
        )
        .scalar_subquery()
    )

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at >= month_start,
            Appointment.status.not_in(["cancelled"]),
            Appointment.patient_id.not_in(previous_patients_subq),
        )
        .options(selectinload(Appointment.patient))
        .order_by(Appointment.scheduled_at)
    )
    appointments = list(result.scalars().all())

    seen: set[uuid.UUID] = set()
    rows = []
    for appt in appointments:
        if appt.patient_id in seen:
            continue
        seen.add(appt.patient_id)
        patient = appt.patient
        local_dt = appt.scheduled_at.astimezone(CLINIC_TZ)
        rows.append({
            "patient_id": str(patient.id),
            "patient_name": patient.full_name,
            "phone": patient.phone,
            "first_appointment_date": local_dt.date().isoformat(),
            "appointment_type": appt.appointment_type,
            "status": appt.status,
        })
    return rows


async def get_returning_patients_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Pacientes que regresaron este mes: tuvieron cita no cancelada este mes
    y además tienen al menos una cita completada en un mes anterior."""
    month_start = _month_start_utc()

    # patient_ids con cita activa este mes
    this_month_subq = (
        select(func.distinct(Appointment.patient_id))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at >= month_start,
            Appointment.status.not_in(["cancelled"]),
        )
        .scalar_subquery()
    )

    # de esos, los que también tuvieron una cita completada antes de este mes
    returning = await db.scalar(
        select(func.count(func.distinct(Appointment.patient_id)))
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.patient_id.isnot(None),
            Appointment.scheduled_at < month_start,
            Appointment.status == "completed",
            Appointment.patient_id.in_(this_month_subq),
        )
    ) or 0

    return {"pacientes_regresaron_mes": returning}


async def get_treatment_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Planes de tratamiento agrupados por estado."""
    rows = await db.execute(
        select(
            TreatmentPlan.status,
            func.count(TreatmentPlan.id).label("count"),
        )
        .where(TreatmentPlan.clinic_id == clinic_id)
        .group_by(TreatmentPlan.status)
    )

    counts = {row.status: row.count for row in rows}
    return {
        "active": counts.get("active", 0),
        "on_hold": counts.get("on_hold", 0),
        "completed": counts.get("completed", 0),
        "abandoned": counts.get("abandoned", 0),
    }


async def get_rewards_stats(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Distribución de pacientes por nivel de Smile Rewards."""
    rows = await db.execute(
        select(
            RewardsAccount.level,
            func.count(RewardsAccount.id).label("count"),
        )
        .where(RewardsAccount.clinic_id == clinic_id)
        .group_by(RewardsAccount.level)
    )

    counts = {row.level: row.count for row in rows}
    total_pts = await db.scalar(
        select(func.coalesce(func.sum(RewardsAccount.total_points), 0)).where(
            RewardsAccount.clinic_id == clinic_id
        )
    ) or 0

    return {
        "by_level": {
            "starter": counts.get("starter", 0),
            "bronze": counts.get("bronze", 0),
            "silver": counts.get("silver", 0),
            "gold": counts.get("gold", 0),
            "diamond": counts.get("diamond", 0),
        },
        "total_points_in_circulation": total_pts,
    }


async def get_todays_schedule(
    db: AsyncSession, clinic_id: uuid.UUID
) -> list[dict]:
    """Agenda del día ordenada por hora — incluye paciente y dentista."""
    day_start, day_end = _today_range_utc()
    logger.info("Dashboard schedule: clinic=%s rango=[%s, %s)", clinic_id, day_start, day_end)

    result = await db.execute(
        select(Appointment)
        .where(
            Appointment.clinic_id == clinic_id,
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at < day_end,
            Appointment.status.not_in(["cancelled"]),
        )
        .options(
            selectinload(Appointment.patient),
            selectinload(Appointment.dentist),
        )
        .order_by(Appointment.scheduled_at)
    )
    appointments = list(result.scalars().all())
    logger.info("Dashboard schedule: encontradas %d citas", len(appointments))

    schedule = []
    for appt in appointments:
        try:
            local_time = appt.scheduled_at.astimezone(CLINIC_TZ)
            patient = appt.patient
            dentist = appt.dentist
            schedule.append({
                "id": str(appt.id),
                "scheduled_at": appt.scheduled_at.isoformat(),
                "scheduled_at_local": local_time.strftime("%H:%M"),
                "duration_minutes": appt.duration_minutes,
                "appointment_type": appt.appointment_type,
                "status": appt.status,
                "patient": {
                    "id": str(patient.id) if patient else None,
                    "full_name": patient.full_name if patient else (appt.guest_name or "Paciente sin registro"),
                    "phone": patient.phone if patient else None,
                },
                "dentist": {
                    "id": str(dentist.id) if dentist else None,
                    "full_name": dentist.full_name if dentist else "Sin asignar",
                },
                "reason": appt.reason,
            })
        except Exception as exc:
            logger.error("Error serializando cita %s en dashboard: %s", appt.id, exc)
    return schedule
