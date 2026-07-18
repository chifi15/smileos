import uuid
from datetime import datetime, timedelta, timezone, date, time
from zoneinfo import ZoneInfo

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.orm import selectinload

from app.models.appointment import Appointment
from app.models.patient import Patient
from app.models.clinic import WorkingHours, ClinicHoliday
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate
from app.core.exceptions import NotFoundError, ValidationError, ConflictError
from app.services.rewards_service import accrue_appointment_rewards

CLINIC_TZ = ZoneInfo("America/Managua")

# Transiciones válidas de la máquina de estados
VALID_TRANSITIONS: dict[str, list[str]] = {
    "scheduled":   ["confirmed", "in_progress", "cancelled", "no_show"],
    "confirmed":   ["in_progress", "cancelled", "no_show"],
    "in_progress": ["completed"],
    "completed":   [],
    "cancelled":   [],
    "no_show":     [],
}


def _end_time(start: datetime, duration: int) -> datetime:
    return start + timedelta(minutes=duration)


async def _validate_slot(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    dentist_id: uuid.UUID,
    scheduled_at: datetime,
    duration_minutes: int,
    exclude_id: uuid.UUID | None = None,
) -> None:
    """Valida horario de trabajo, festivos y solapamiento de citas."""
    local_dt = scheduled_at.astimezone(CLINIC_TZ)
    db_day = local_dt.isoweekday() % 7  # 0=Dom, 1=Lun ... 6=Sáb
    local_time = local_dt.time()
    end_local = _end_time(local_dt, duration_minutes).time()
    appt_date = local_dt.date()

    # 1. Día festivo
    holiday = await db.scalar(
        select(ClinicHoliday).where(
            ClinicHoliday.clinic_id == clinic_id,
            ClinicHoliday.date == appt_date,
        )
    )
    if holiday:
        raise ValidationError(f"El {appt_date} es día festivo: {holiday.description or 'Día no laborable'}.")

    # 2. Horario de trabajo
    wh = await db.scalar(
        select(WorkingHours).where(
            WorkingHours.clinic_id == clinic_id,
            WorkingHours.day_of_week == db_day,
        )
    )
    if not wh or not wh.is_working_day:
        days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
        raise ValidationError(f"La clínica no atiende los {days[db_day]}.")

    in_morning = (
        wh.morning_open and wh.morning_close
        and local_time >= wh.morning_open
        and end_local <= wh.morning_close
    )
    in_afternoon = (
        wh.afternoon_open and wh.afternoon_close
        and local_time >= wh.afternoon_open
        and end_local <= wh.afternoon_close
    )
    if not in_morning and not in_afternoon:
        raise ValidationError(
            "El horario solicitado está fuera del horario de atención de la clínica."
        )

    # 3. Solapamiento con otras citas del mismo dentista
    end_at = _end_time(scheduled_at, duration_minutes)
    # Solapamiento: existing_start < new_end AND existing_end > new_start
    # make_interval(years, months, weeks, days, hours, mins) — posicional
    existing_end = Appointment.scheduled_at + func.make_interval(
        0, 0, 0, 0, 0, Appointment.duration_minutes
    )
    overlap_q = select(Appointment).where(
        Appointment.clinic_id == clinic_id,
        Appointment.dentist_id == dentist_id,
        Appointment.status.not_in(["cancelled", "no_show"]),
        Appointment.scheduled_at < end_at,
        existing_end > scheduled_at,
    )
    if exclude_id:
        overlap_q = overlap_q.where(Appointment.id != exclude_id)

    overlapping = await db.scalar(overlap_q)
    if overlapping:
        raise ConflictError("El dentista ya tiene una cita en ese horario.")


def _load_options():
    return [
        selectinload(Appointment.patient).selectinload(Patient.rewards_account),
        selectinload(Appointment.dentist),
        selectinload(Appointment.created_by),
    ]


async def get_appointment(
    db: AsyncSession, clinic_id: uuid.UUID, appointment_id: uuid.UUID
) -> Appointment:
    result = await db.execute(
        select(Appointment)
        .options(*_load_options())
        .where(Appointment.id == appointment_id, Appointment.clinic_id == clinic_id)
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise NotFoundError("Cita")
    return appt


async def create_appointment(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    created_by_id: uuid.UUID,
    data: AppointmentCreate,
) -> Appointment:
    # Normalizar a UTC con timezone info
    scheduled_at = data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=CLINIC_TZ)
    scheduled_at = scheduled_at.astimezone(timezone.utc)

    await _validate_slot(db, clinic_id, data.dentist_id, scheduled_at, data.duration_minutes)

    appt = Appointment(
        clinic_id=clinic_id,
        patient_id=data.patient_id,
        dentist_id=data.dentist_id,
        created_by_id=created_by_id,
        scheduled_at=scheduled_at,
        duration_minutes=data.duration_minutes,
        appointment_type=data.appointment_type,
        status="scheduled",
        reason=data.reason,
        notes=data.notes,
    )
    db.add(appt)
    await db.flush()
    return await get_appointment(db, clinic_id, appt.id)


async def update_appointment(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID,
    data: AppointmentUpdate,
) -> Appointment:
    appt = await get_appointment(db, clinic_id, appointment_id)
    if appt.status not in ("scheduled", "confirmed"):
        raise ValidationError("Solo se pueden editar citas en estado 'programada' o 'confirmada'.")

    update_data = data.model_dump(exclude_unset=True)

    scheduled_at = update_data.get("scheduled_at", appt.scheduled_at)
    duration = update_data.get("duration_minutes", appt.duration_minutes)
    dentist_id = update_data.get("dentist_id", appt.dentist_id)

    if "scheduled_at" in update_data or "duration_minutes" in update_data or "dentist_id" in update_data:
        if isinstance(scheduled_at, datetime) and scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=CLINIC_TZ)
        await _validate_slot(db, clinic_id, dentist_id, scheduled_at, duration, exclude_id=appointment_id)

    for field, value in update_data.items():
        setattr(appt, field, value)

    await db.flush()
    return await get_appointment(db, clinic_id, appointment_id)


async def _transition(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID,
    new_status: str,
    **extra_fields,
) -> Appointment:
    appt = await get_appointment(db, clinic_id, appointment_id)
    if new_status not in VALID_TRANSITIONS.get(appt.status, []):
        raise ValidationError(
            f"No se puede pasar de '{appt.status}' a '{new_status}'."
        )
    appt.status = new_status
    for field, value in extra_fields.items():
        setattr(appt, field, value)
    await db.flush()
    return await get_appointment(db, clinic_id, appointment_id)


async def confirm_appointment(
    db: AsyncSession, clinic_id: uuid.UUID, appointment_id: uuid.UUID
) -> Appointment:
    return await _transition(
        db, clinic_id, appointment_id, "confirmed",
        confirmed_at=datetime.now(timezone.utc),
    )


async def start_appointment(
    db: AsyncSession, clinic_id: uuid.UUID, appointment_id: uuid.UUID
) -> Appointment:
    return await _transition(
        db, clinic_id, appointment_id, "in_progress",
        started_at=datetime.now(timezone.utc),
    )


async def complete_appointment(
    db: AsyncSession, clinic_id: uuid.UUID, appointment_id: uuid.UUID
) -> Appointment:
    completed_at = datetime.now(timezone.utc)
    appt = await _transition(
        db, clinic_id, appointment_id, "completed",
        completed_at=completed_at,
    )
    # Acumular puntos Smile Rewards
    await accrue_appointment_rewards(
        db,
        clinic_id=clinic_id,
        patient_id=appt.patient_id,
        appointment_id=appt.id,
        appointment_type=appt.appointment_type,
        completed_at=completed_at,
    )
    await db.flush()
    return await get_appointment(db, clinic_id, appointment_id)


async def no_show_appointment(
    db: AsyncSession, clinic_id: uuid.UUID, appointment_id: uuid.UUID
) -> Appointment:
    return await _transition(db, clinic_id, appointment_id, "no_show")


async def cancel_appointment(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID,
    cancellation_reason: str | None,
) -> Appointment:
    return await _transition(
        db, clinic_id, appointment_id, "cancelled",
        cancelled_at=datetime.now(timezone.utc),
        cancellation_reason=cancellation_reason,
    )


async def list_appointments(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    date_from: date | None = None,
    date_to: date | None = None,
    patient_id: uuid.UUID | None = None,
    dentist_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[Appointment]:
    q = (
        select(Appointment)
        .options(*_load_options())
        .where(Appointment.clinic_id == clinic_id)
        .order_by(Appointment.scheduled_at)
    )
    if date_from:
        q = q.where(Appointment.scheduled_at >= datetime(date_from.year, date_from.month, date_from.day, tzinfo=timezone.utc))
    if date_to:
        q = q.where(Appointment.scheduled_at < datetime(date_to.year, date_to.month, date_to.day + 1, tzinfo=timezone.utc))
    if patient_id:
        q = q.where(Appointment.patient_id == patient_id)
    if dentist_id:
        q = q.where(Appointment.dentist_id == dentist_id)
    if status:
        q = q.where(Appointment.status == status)

    result = await db.execute(q)
    return list(result.scalars().all())


async def get_available_slots(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    dentist_id: uuid.UUID,
    slot_date: date,
    duration_minutes: int = 30,
    slot_size: int = 15,
) -> list[str]:
    """Retorna lista de horas disponibles (HH:MM) para el día dado."""
    db_day = datetime(slot_date.year, slot_date.month, slot_date.day).isoweekday() % 7

    wh = await db.scalar(
        select(WorkingHours).where(
            WorkingHours.clinic_id == clinic_id,
            WorkingHours.day_of_week == db_day,
        )
    )
    if not wh or not wh.is_working_day:
        return []

    holiday = await db.scalar(
        select(ClinicHoliday).where(
            ClinicHoliday.clinic_id == clinic_id,
            ClinicHoliday.date == slot_date,
        )
    )
    if holiday:
        return []

    # Citas existentes del dentista ese día
    day_start = datetime(slot_date.year, slot_date.month, slot_date.day, tzinfo=CLINIC_TZ).astimezone(timezone.utc)
    day_end = day_start + timedelta(days=1)
    existing = await db.execute(
        select(Appointment.scheduled_at, Appointment.duration_minutes).where(
            Appointment.clinic_id == clinic_id,
            Appointment.dentist_id == dentist_id,
            Appointment.scheduled_at >= day_start,
            Appointment.scheduled_at < day_end,
            Appointment.status.not_in(["cancelled", "no_show"]),
        )
    )
    booked = [(r.scheduled_at, r.duration_minutes) for r in existing]

    def _slots_from_range(open_t: time | None, close_t: time | None) -> list[str]:
        if not open_t or not close_t:
            return []
        slots = []
        cursor = datetime(slot_date.year, slot_date.month, slot_date.day,
                          open_t.hour, open_t.minute, tzinfo=CLINIC_TZ)
        close_dt = datetime(slot_date.year, slot_date.month, slot_date.day,
                            close_t.hour, close_t.minute, tzinfo=CLINIC_TZ)
        while cursor + timedelta(minutes=duration_minutes) <= close_dt:
            cursor_utc = cursor.astimezone(timezone.utc)
            end_cursor = cursor_utc + timedelta(minutes=duration_minutes)
            is_free = all(
                cursor_utc >= b_start + timedelta(minutes=b_dur) or end_cursor <= b_start
                for b_start, b_dur in booked
            )
            if is_free:
                slots.append(cursor.strftime("%H:%M"))
            cursor += timedelta(minutes=slot_size)
        return slots

    return (
        _slots_from_range(wh.morning_open, wh.morning_close)
        + _slots_from_range(wh.afternoon_open, wh.afternoon_close)
    )
