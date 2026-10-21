"""
Endpoints públicos para que los pacientes reserven citas.
No requieren autenticación.
"""
import uuid
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.clinic import Clinic, ClinicSettings, WorkingHours
from app.models.user import User
from app.models.appointment import Appointment
from app.services.appointment_service import get_available_slots, _validate_slot

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
            User.role.in_(["dentist", "clinic_owner", "admin"]),
            User.deleted_at.is_(None),
        ).order_by(User.full_name)
    )).scalars().all()

    return {
        "success": True,
        "data": {
            "clinic_name": settings.display_name if settings and settings.display_name else clinic.name,
            "slug": clinic.slug,
            "phone": settings.phone if settings else None,
            "address": settings.address_line1 if settings else None,
            "city": settings.city if settings else None,
            "default_duration": settings.default_appointment_duration_minutes if settings else 30,
            "slot_size": settings.appointment_slot_size_minutes if settings else 15,
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
    db: AsyncSession = Depends(get_db),
):
    clinic = await _get_clinic(clinic_slug, db)

    try:
        slot_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="Fecha inválida, usa YYYY-MM-DD")

    if slot_date < date.today():
        return {"success": True, "data": {"slots": []}}

    settings = await db.scalar(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic.id)
    )
    duration = settings.default_appointment_duration_minutes if settings else 30
    slot_size = settings.appointment_slot_size_minutes if settings else 15

    dentists = (await db.execute(
        select(User).where(
            User.clinic_id == clinic.id,
            User.role.in_(["dentist", "clinic_owner", "admin"]),
            User.deleted_at.is_(None),
        )
    )).scalars().all()

    if not dentists:
        return {"success": True, "data": {"slots": []}}

    # Unión de slots disponibles de todos los dentistas
    all_slots: set[str] = set()
    slot_dentist: dict[str, str] = {}  # slot → first available dentist id

    for dentist in dentists:
        dentist_slots = await get_available_slots(
            db, clinic.id, dentist.id, slot_date, duration, slot_size
        )
        for s in dentist_slots:
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
    duration = settings.default_appointment_duration_minutes if settings else 30
    slot_size = settings.appointment_slot_size_minutes if settings else 15

    # Encontrar dentista disponible para ese slot
    dentists = (await db.execute(
        select(User).where(
            User.clinic_id == clinic.id,
            User.role.in_(["dentist", "clinic_owner", "admin"]),
            User.deleted_at.is_(None),
        )
    )).scalars().all()

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

    from app.services.appointment_service import CLINIC_TZ
    scheduled_at = datetime(
        slot_date.year, slot_date.month, slot_date.day,
        hour, minute, tzinfo=CLINIC_TZ
    ).astimezone(__import__("datetime").timezone.utc).replace(tzinfo=None)

    # Obtener el usuario owner para created_by
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

    return {
        "success": True,
        "data": {
            "id": str(appointment.id),
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "dentist_name": available_dentist.full_name,
            "duration_minutes": duration,
        },
    }
