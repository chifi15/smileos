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
from app.models.clinic import Clinic, ClinicSettings, WorkingHours, ClinicHoliday
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
        {"value": "primera_consulta", "label": "Consulta",   "duration_minutes": 30},
        {"value": "control",          "label": "Control",    "duration_minutes": 30},
        {"value": "limpieza",         "label": "Profilaxis", "duration_minutes": 60},
        {"value": "extraccion",       "label": "Extracción", "duration_minutes": 45},
        {"value": "emergencia",       "label": "Emergencia", "duration_minutes": 30},
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

    # Todas las citas de la clínica ese día (cualquier doctor) — la clínica
    # comparte una sola sala, por lo que si algún doctor está ocupado ese slot
    # no está disponible para nadie más.
    all_clinic_appts = (await db.execute(
        select(Appointment.scheduled_at, Appointment.duration_minutes).where(
            Appointment.clinic_id == clinic.id,
            Appointment.scheduled_at >= day_start_utc,
            Appointment.scheduled_at < day_end_utc,
            Appointment.status.not_in(["cancelled", "no_show"]),
            Appointment.deleted_at.is_(None),
        )
    )).all()
    clinic_booked = [(r.scheduled_at, r.duration_minutes) for r in all_clinic_appts]

    all_slots: set[str] = set()
    slot_dentist: dict[str, str] = {}

    for dentist in dentists:
        dentist_slots = await get_available_slots(
            db, clinic.id, dentist.id, slot_date, duration, slot_size
        )
        for s in dentist_slots:
            h, m = map(int, s.split(":"))
            slot_start = datetime(
                slot_date.year, slot_date.month, slot_date.day, h, m, tzinfo=CLINIC_TZ
            ).astimezone(timezone.utc)
            slot_end = slot_start + timedelta(minutes=duration)

            gcal_conflict = any(
                slot_start < ev_end and slot_end > ev_start
                for ev_start, ev_end in gcal_events
            )

            # Bloquear si cualquier doctor de la clínica ya tiene cita en ese slot
            clinic_conflict = any(
                slot_start < b_start + timedelta(minutes=b_dur) and slot_end > b_start
                for b_start, b_dur in clinic_booked
            )

            if not gcal_conflict and not clinic_conflict:
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


# ─── Días disponibles del mes ────────────────────────────────────────────────

@router.get("/{clinic_slug}/available-days")
async def get_available_days(
    clinic_slug: str,
    month: str = Query(..., description="YYYY-MM"),
    dentist_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    import calendar as _cal
    from collections import defaultdict
    from zoneinfo import ZoneInfo

    clinic = await _get_clinic(clinic_slug, db)

    try:
        year, mon = map(int, month.split("-"))
    except ValueError:
        raise HTTPException(status_code=422, detail="month debe ser YYYY-MM")

    settings = await db.scalar(select(ClinicSettings).where(ClinicSettings.clinic_id == clinic.id))
    duration = settings.default_appointment_duration_minutes if settings else 60
    slot_size = 60

    wh_rows = (await db.execute(
        select(WorkingHours).where(WorkingHours.clinic_id == clinic.id)
    )).scalars().all()
    wh_map = {wh.day_of_week: wh for wh in wh_rows}

    days_in_month = _cal.monthrange(year, mon)[1]
    first_day = date(year, mon, 1)
    last_day = date(year, mon, days_in_month)

    holiday_dates = set((await db.execute(
        select(ClinicHoliday.date).where(
            ClinicHoliday.clinic_id == clinic.id,
            ClinicHoliday.date >= first_day,
            ClinicHoliday.date <= last_day,
        )
    )).scalars().all())

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

    _TZ = ZoneInfo("America/Managua")
    month_start_utc = datetime(year, mon, 1, tzinfo=_TZ).astimezone(timezone.utc)
    month_end_utc = datetime(year, mon, days_in_month, 23, 59, 59, tzinfo=_TZ).astimezone(timezone.utc)

    appts_result = (await db.execute(
        select(Appointment.scheduled_at, Appointment.duration_minutes).where(
            Appointment.clinic_id == clinic.id,
            Appointment.scheduled_at >= month_start_utc,
            Appointment.scheduled_at <= month_end_utc,
            Appointment.status.not_in(["cancelled", "no_show"]),
            Appointment.deleted_at.is_(None),
        )
    )).all()

    appts_by_date: dict = defaultdict(list)
    for appt in appts_result:
        scheduled = appt.scheduled_at
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        local_date = scheduled.astimezone(_TZ).date()
        appts_by_date[local_date].append((scheduled.astimezone(timezone.utc), appt.duration_minutes))

    today = date.today()
    available_days = []

    for day_num in range(1, days_in_month + 1):
        d = date(year, mon, day_num)
        if d < today:
            continue
        if d in holiday_dates:
            continue
        dow = datetime(year, mon, day_num).isoweekday() % 7
        wh = wh_map.get(dow)
        if not wh or not wh.is_working_day:
            continue
        if not dentists:
            continue

        def _slots(open_t, close_t):
            if not open_t or not close_t:
                return []
            result = []
            from datetime import time as _time
            cursor = datetime(year, mon, day_num, open_t.hour, open_t.minute, tzinfo=_TZ).astimezone(timezone.utc)
            close_utc = datetime(year, mon, day_num, close_t.hour, close_t.minute, tzinfo=_TZ).astimezone(timezone.utc)
            while cursor + timedelta(minutes=duration) <= close_utc:
                result.append(cursor)
                cursor += timedelta(minutes=slot_size)
            return result

        possible = _slots(wh.morning_open, wh.morning_close) + _slots(wh.afternoon_open, wh.afternoon_close)
        if not possible:
            continue

        day_booked = appts_by_date.get(d, [])
        has_free = any(
            not any(
                s < b_start + timedelta(minutes=b_dur) and s + timedelta(minutes=duration) > b_start
                for b_start, b_dur in day_booked
            )
            for s in possible
        )
        if has_free:
            available_days.append(d.isoformat())

    return {
        "success": True,
        "data": {
            "available_days": available_days,
            "holidays": [h.isoformat() for h in holiday_dates],
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
        guest_phone=body.guest_phone.strip() or None,
        reason=body.reason.strip() or None,
        status="scheduled",
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    # Crear evento en Google Calendar si hay OAuth conectado
    try:
        if settings and settings.google_refresh_token:
            from app.services import google_oauth_service as oauth
            from zoneinfo import ZoneInfo
            _CLINIC_TZ = ZoneInfo("America/Managua")
            from datetime import timezone as _tz
            access_token = await oauth.refresh_access_token(settings.google_refresh_token)
            cal_id = settings.google_calendar_id or "primary"
            scheduled_utc = appointment.scheduled_at
            if scheduled_utc.tzinfo is None:
                scheduled_utc = scheduled_utc.replace(tzinfo=_tz.utc)
            start_local = scheduled_utc.astimezone(_CLINIC_TZ)
            end_local = (scheduled_utc + timedelta(minutes=duration)).astimezone(_CLINIC_TZ)
            gcal_event = await oauth.create_google_event(
                access_token, cal_id,
                summary=body.guest_name.strip(),
                start_dt=start_local,
                end_dt=end_local,
                description=body.reason.strip() if body.reason else "",
                color_id=available_dentist.gcal_color_id,
            )
            appointment.google_event_id = gcal_event.get("id")
            await db.commit()
    except Exception:
        import traceback
        traceback.print_exc()

    # Notificar por email a la clínica
    notify_email = (settings.email if settings and settings.email else None) or owner.email
    if notify_email:
        from app.services.email_service import send_booking_notification_email
        from datetime import timezone as _tz2
        import asyncio
        scheduled_utc_mail = appointment.scheduled_at
        if scheduled_utc_mail.tzinfo is None:
            scheduled_utc_mail = scheduled_utc_mail.replace(tzinfo=_tz2.utc)
        asyncio.get_running_loop().run_in_executor(
            None,
            send_booking_notification_email,
            notify_email,
            settings.display_name if settings and settings.display_name else clinic.name,
            body.guest_name.strip(),
            body.guest_phone,
            scheduled_utc_mail,
            duration,
            available_dentist.full_name,
            body.appointment_type,
            body.reason.strip() if body.reason else "",
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
