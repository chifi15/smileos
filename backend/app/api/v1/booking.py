"""
Endpoints públicos para que los pacientes reserven citas.
No requieren autenticación.
"""
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.calendar import CalendarEvent
from app.models.clinic import Clinic, ClinicSettings, WorkingHours
from app.models.user import User
from app.models.appointment import Appointment
from app.services.appointment_service import get_available_slots, CLINIC_TZ

router = APIRouter(prefix="/booking", tags=["Reservas públicas"])


async def _get_clinic(slug: str, db: AsyncSession) -> Clinic:
    clinic = await db.scalar(select(Clinic).where(Clinic.slug == slug, Clinic.is_active == True))  # noqa: E712
    if not clinic:
        raise HTTPException(status_code=404, detail="Clínica no encontrada")
    return clinic


# ─── Info de la clínica ──────────────────────────────────────────────────────

@router.get("/{clinic_slug}")
async def get_booking_info(
    clinic_slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clinic = await _get_clinic(clinic_slug, db)

    settings = await db.scalar(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic.id)
    )

    working_hours = (await db.execute(
        select(WorkingHours).where(WorkingHours.clinic_id == clinic.id)
    )).scalars().all()

    dentists = (await db.execute(
        select(User).where(
            User.clinic_id == clinic.id,
            User.role.in_(["dentist", "clinic_owner"]),
            User.is_active == True,  # noqa: E712
        ).order_by(User.full_name)
    )).scalars().all()

    default_types = [
        {"value": "primera_consulta", "label": "Consulta"},
        {"value": "control",          "label": "Control"},
        {"value": "limpieza",         "label": "Profilaxis"},
        {"value": "extraccion",       "label": "Extracción"},
        {"value": "emergencia",       "label": "Emergencia"},
    ]
    appt_types = (settings.booking_appointment_types if settings and settings.booking_appointment_types else default_types)

    return {
        "success": True,
        "data": {
            "clinic_name": settings.display_name if settings and settings.display_name else clinic.name,
            "slug": clinic.slug,
            "phone": settings.phone if settings else None,
            "address": settings.address_line1 if settings else None,
            "city": settings.city if settings else None,
            "default_duration": settings.default_appointment_duration_minutes if settings else 60,
            "slot_size": settings.appointment_slot_size_minutes if settings else 60,
            "appointment_types": appt_types,
            "working_days": [
                {
                    "day": wh.day_of_week,
                    "is_working": wh.is_working_day,
                    "morning_open": wh.morning_open.strftime("%H:%M") if wh.morning_open else None,
                    "morning_close": wh.morning_close.strftime("%H:%M") if wh.morning_close else None,
                    "afternoon_open": wh.afternoon_open.strftime("%H:%M") if wh.afternoon_open else None,
                    "afternoon_close": wh.afternoon_close.strftime("%H:%M") if wh.afternoon_close else None,
                }
                for wh in sorted(working_hours, key=lambda w: w.day_of_week)
            ],
            "dentists": [
                {"id": str(d.id), "name": d.full_name}
                for d in dentists
            ],
        },
    }


# ─── Slots disponibles ───────────────────────────────────────────────────────

@router.get("/{clinic_slug}/slots")
async def get_booking_slots(
    clinic_slug: str,
    date_str: str = Query(alias="date"),
    dentist_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    clinic = await _get_clinic(clinic_slug, db)

    try:
        slot_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida, usa YYYY-MM-DD")

    if slot_date < date.today():
        return {"success": True, "data": {"slots": [], "slot_dentist": {}}}

    settings = await db.scalar(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic.id)
    )
    duration = settings.default_appointment_duration_minutes if settings else 60
    # Slots aparecen cada 'duration' minutos (ej. cada 60 min si la cita dura 60 min)
    slot_size = 60  # pacientes ven horarios cada hora

    # Filtrar por dentista específico si se indica
    dentist_filter = [
        User.clinic_id == clinic.id,
        User.role.in_(["dentist", "clinic_owner", "admin"]),
        User.is_active == True,  # noqa: E712
    ]
    if dentist_id:
        try:
            dentist_filter.append(User.id == uuid.UUID(dentist_id))
        except ValueError:
            pass

    dentists = (await db.execute(select(User).where(*dentist_filter))).scalars().all()

    if not dentists:
        return {"success": True, "data": {"slots": [], "slot_dentist": {}}}

    # Eventos de Google Calendar para ese día (bloquean disponibilidad)
    day_start_utc = datetime(
        slot_date.year, slot_date.month, slot_date.day, tzinfo=CLINIC_TZ
    ).astimezone(timezone.utc)
    day_end_utc = day_start_utc + timedelta(days=1)

    gcal_events = (await db.execute(
        select(CalendarEvent.start_at, CalendarEvent.end_at).where(
            CalendarEvent.clinic_id == clinic.id,
            CalendarEvent.start_at < day_end_utc,
            CalendarEvent.end_at > day_start_utc,
        )
    )).all()

    all_slots: set[str] = set()
    slot_dentist: dict[str, str] = {}

    for dentist in dentists:
        dentist_slots = await get_available_slots(
            db, clinic.id, dentist.id, slot_date, duration, slot_size
        )
        for s in dentist_slots:
            # Verificar conflicto con eventos de Google Calendar
            h, m = map(int, s.split(":"))
            slot_start = datetime(
                slot_date.year, slot_date.month, slot_date.day, h, m, tzinfo=CLINIC_TZ
            ).astimezone(timezone.utc)
            slot_end = slot_start + timedelta(minutes=duration)

            gcal_conflict = any(
                slot_start < ev_end and slot_end > ev_start
                for ev_start, ev_end in gcal_events
            )

            if not gcal_conflict:
                all_slots.add(s)
                if s not in slot_dentist:
                    slot_dentist[s] = str(dentist.id)

    sorted_slots = sorted(all_slots)
    return {
        "success": True,
        "data": {
            "date": date_str,
            "slots": sorted_slots,
            "slot_dentist": slot_dentist,
        },
    }


# ─── Crear solicitud de cita ─────────────────────────────────────────────────

class BookingRequest(BaseModel):
    date: str
    time: str
    guest_name: str
    guest_phone: str = ""
    appointment_type: str = "primera_consulta"
    reason: str = ""
    dentist_id: str | None = None  # ID del dentista elegido por el paciente


@router.post("/{clinic_slug}/request")
async def create_booking_request(
    clinic_slug: str,
    body: BookingRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clinic = await _get_clinic(clinic_slug, db)

    if not body.guest_name.strip():
        raise HTTPException(status_code=422, detail="El nombre es obligatorio")

    try:
        slot_date = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida")

    if slot_date < date.today():
        raise HTTPException(status_code=422, detail="No se pueden reservar citas en el pasado")

    try:
        hour, minute = map(int, body.time.split(":"))
    except ValueError:
        raise HTTPException(status_code=422, detail="Hora inválida")

    settings = await db.scalar(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic.id)
    )
    duration = settings.default_appointment_duration_minutes if settings else 60
    slot_size = 60  # pacientes ven horarios cada hora

    # Buscar dentistas disponibles (respetando preferencia del paciente)
    dentist_filter = [
        User.clinic_id == clinic.id,
        User.role.in_(["dentist", "clinic_owner", "admin"]),
        User.is_active == True,  # noqa: E712
    ]
    if body.dentist_id:
        try:
            dentist_filter.append(User.id == uuid.UUID(body.dentist_id))
        except ValueError:
            pass

    dentists = (await db.execute(select(User).where(*dentist_filter))).scalars().all()

    if not dentists:
        raise HTTPException(status_code=422, detail="No hay dentistas disponibles")

    available_dentist = None
    for dentist in dentists:
        slots = await get_available_slots(
            db, clinic.id, dentist.id, slot_date, duration, slot_size
        )
        if body.time in slots:
            available_dentist = dentist
            break

    if not available_dentist:
        raise HTTPException(status_code=409, detail="El horario ya no está disponible")

    scheduled_at = datetime(
        slot_date.year, slot_date.month, slot_date.day,
        hour, minute, tzinfo=CLINIC_TZ
    ).astimezone(timezone.utc).replace(tzinfo=None)

    owner = await db.scalar(
        select(User).where(
            User.clinic_id == clinic.id,
            User.role == "clinic_owner",
        )
    )
    if not owner:
        owner = dentists[0]

    appointment = Appointment(
        id=uuid.uuid4(),
        clinic_id=clinic.id,
        dentist_id=available_dentist.id,
        created_by_id=owner.id,
        scheduled_at=scheduled_at,
        duration_minutes=duration,
        appointment_type=body.appointment_type,
        guest_name=body.guest_name.strip(),
        reason=body.reason.strip() or None,
        status="scheduled",
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    # Notificar por email a la clínica
    notify_email = (settings.email if settings and settings.email else None) or owner.email
    if notify_email:
        from app.services.email_service import send_booking_notification_email
        from datetime import timezone as _tz
        import asyncio
        scheduled_utc = appointment.scheduled_at.replace(tzinfo=_tz.utc)
        asyncio.get_event_loop().run_in_executor(
            None,
            send_booking_notification_email,
            notify_email,
            settings.display_name if settings and settings.display_name else clinic.name,
            body.guest_name.strip(),
            body.guest_phone,
            scheduled_utc,
            duration,
            available_dentist.full_name,
            body.appointment_type,
            body.reason.strip(),
        )

    return {
        "success": True,
        "data": {
            "id": str(appointment.id),
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "dentist_name": available_dentist.full_name,
            "duration_minutes": duration,
        },
    }
