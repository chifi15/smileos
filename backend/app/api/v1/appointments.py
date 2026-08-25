import uuid
from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate, CancelRequest
from app.services import appointment_service, audit_service
from app.models.clinic import ClinicSettings

router = APIRouter(prefix="/appointments", tags=["Agenda"])


def _serialize(appt) -> dict:
    patient = appt.patient
    rewards = patient.rewards_account if patient else None
    dentist = appt.dentist
    from datetime import timedelta
    end_at = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)

    def _iso(dt):
        return dt.isoformat() if dt else None

    return {
        "id": str(appt.id),
        "clinic_id": str(appt.clinic_id),
        "patient_id": str(appt.patient_id),
        "patient_name": patient.full_name if patient else "",
        "patient_rewards_level": rewards.level if rewards else None,
        "dentist_id": str(appt.dentist_id),
        "dentist_name": dentist.full_name if dentist else "",
        "scheduled_at": _iso(appt.scheduled_at),
        "end_at": _iso(end_at),
        "duration_minutes": appt.duration_minutes,
        "appointment_type": appt.appointment_type,
        "status": appt.status,
        "reason": appt.reason,
        "notes": appt.notes,
        "confirmed_at": _iso(appt.confirmed_at),
        "started_at": _iso(appt.started_at),
        "completed_at": _iso(appt.completed_at),
        "cancelled_at": _iso(appt.cancelled_at),
        "cancellation_reason": appt.cancellation_reason,
        "gcal_color_id": appt.gcal_color_id,
        "created_at": _iso(appt.created_at),
    }


@router.post("", status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.create_appointment(
        db, user.clinic_id, user.id, body
    )
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.created", resource_type="appointment", resource_id=str(appt.id),
        description=f"Programó cita para {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )

    # Crear en Google Calendar si hay OAuth conectado (fallo silencioso)
    try:
        settings_row = await db.execute(
            select(ClinicSettings.google_refresh_token, ClinicSettings.google_calendar_id)
            .where(ClinicSettings.clinic_id == user.clinic_id)
        )
        cfg = settings_row.one_or_none()
        if cfg and cfg.google_refresh_token:
            from app.services import google_oauth_service as oauth
            access_token = await oauth.refresh_access_token(cfg.google_refresh_token)
            cal_id = cfg.google_calendar_id or "primary"
            patient_name = appt.patient.full_name if appt.patient else ""
            end_at = appt.scheduled_at + timedelta(minutes=appt.duration_minutes)
            await oauth.create_google_event(
                access_token, cal_id,
                summary=patient_name,
                start_dt=appt.scheduled_at,
                end_dt=end_at,
                description=appt.reason or "",
                color_id=appt.gcal_color_id,
            )
    except Exception:
        pass  # Google Calendar no disponible; la cita igual está en SmileOS

    return {"success": True, "data": _serialize(appt)}


@router.get("")
async def list_appointments(
    user: Annotated[object, require_permission("view_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    patient_id: uuid.UUID | None = Query(default=None),
    dentist_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
):
    # Si no se especifica rango, retorna la semana actual
    if not date_from and not date_to:
        today = date.today()
        date_from = today - timedelta(days=today.weekday())  # lunes
        date_to = date_from + timedelta(days=6)              # domingo

    appointments = await appointment_service.list_appointments(
        db, user.clinic_id,
        date_from=date_from, date_to=date_to,
        patient_id=patient_id, dentist_id=dentist_id,
        status=status,
    )
    return {"success": True, "data": [_serialize(a) for a in appointments]}


@router.get("/availability")
async def get_availability(
    user: Annotated[object, require_permission("view_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
    dentist_id: uuid.UUID = Query(...),
    date: date = Query(...),
    duration_minutes: int = Query(default=30, ge=15, le=480),
):
    slots = await appointment_service.get_available_slots(
        db, user.clinic_id, dentist_id, date, duration_minutes
    )
    return {"success": True, "data": {"date": date.isoformat(), "slots": slots}}


@router.get("/{appointment_id}")
async def get_appointment(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("view_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.get_appointment(db, user.clinic_id, appointment_id)
    return {"success": True, "data": _serialize(appt)}


@router.patch("/{appointment_id}")
async def update_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentUpdate,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.update_appointment(db, user.clinic_id, appointment_id, body)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.updated", resource_type="appointment", resource_id=str(appt.id),
        description=f"Editó cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}


@router.post("/{appointment_id}/confirm")
async def confirm(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.confirm_appointment(db, user.clinic_id, appointment_id)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.confirmed", resource_type="appointment", resource_id=str(appt.id),
        description=f"Confirmó cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}


@router.post("/{appointment_id}/start")
async def start(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("complete_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.start_appointment(db, user.clinic_id, appointment_id)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.started", resource_type="appointment", resource_id=str(appt.id),
        description=f"Inició cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}


@router.post("/{appointment_id}/complete")
async def complete(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("complete_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.complete_appointment(db, user.clinic_id, appointment_id)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.completed", resource_type="appointment", resource_id=str(appt.id),
        description=f"Completó cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}


@router.post("/{appointment_id}/no-show")
async def no_show(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.no_show_appointment(db, user.clinic_id, appointment_id)
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.no_show", resource_type="appointment", resource_id=str(appt.id),
        description=f"Marcó no-show en cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}


@router.delete("/{appointment_id}")
async def delete_appointment(
    appointment_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await appointment_service.delete_appointment(db, user.clinic_id, appointment_id)
    return {"success": True}


@router.post("/{appointment_id}/cancel")
async def cancel(
    appointment_id: uuid.UUID,
    body: CancelRequest,
    user: Annotated[object, require_permission("manage_appointments")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    appt = await appointment_service.cancel_appointment(
        db, user.clinic_id, appointment_id, body.cancellation_reason
    )
    await audit_service.log(
        db, clinic_id=user.clinic_id, user_id=user.id,
        action="appointment.cancelled", resource_type="appointment", resource_id=str(appt.id),
        description=f"Canceló cita de {appt.patient.full_name if appt.patient else ''}",
        patient_id=appt.patient_id,
    )
    return {"success": True, "data": _serialize(appt)}
