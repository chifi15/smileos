"""
Servicio de Dashboard — agrega KPIs en tiempo real desde la base de datos.
Todas las consultas están aisladas por clinic_id; sin caché por ahora (v0.1).
"""
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, cast, Date
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.treatment import TreatmentPlan
from app.models.rewards import RewardsAccount

CLINIC_TZ = ZoneInfo("America/Managua")


def _today_range_utc() -> tuple[datetime, datetime]:
    """Inicio y fin del día de hoy en UTC, usando la zona horaria de la clínica."""
    now_local = datetime.now(CLINIC_TZ)
    today_start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end_local = today_start_local + timedelta(days=1)
    return today_start_local.astimezone(timezone.utc), today_end_local.astimezone(timezone.utc)


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

    schedule = []
    for appt in appointments:
        # Convertir a hora local de la clínica para mostrar
        local_time = appt.scheduled_at.astimezone(CLINIC_TZ)
        schedule.append({
            "id": str(appt.id),
            "scheduled_at": appt.scheduled_at.isoformat(),
            "scheduled_at_local": local_time.strftime("%H:%M"),
            "duration_minutes": appt.duration_minutes,
            "appointment_type": appt.appointment_type,
            "status": appt.status,
            "patient": {
                "id": str(appt.patient.id),
                "full_name": appt.patient.full_name,
                "phone": appt.patient.phone,
            },
            "dentist": {
                "id": str(appt.dentist.id),
                "full_name": appt.dentist.full_name,
            },
            "reason": appt.reason,
        })
    return schedule
