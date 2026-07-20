import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.schemas.settings import (
    ClinicSettingsUpdate,
    WorkingHoursBulkUpdate,
    HolidayCreate,
    UserCreate,
    UserUpdate,
)
from app.services import settings_service

settings_router = APIRouter(prefix="/settings", tags=["Configuración de Clínica"])
users_router = APIRouter(prefix="/users", tags=["Gestión de Usuarios"])


# ─── Serializers ──────────────────────────────────────────────────────────────

def _serialize_settings(s) -> dict:
    return {
        "id": str(s.id),
        "display_name": s.display_name,
        "legal_name": s.legal_name,
        "tax_id": s.tax_id,
        "phone": s.phone,
        "email": s.email,
        "website": s.website,
        "address_line1": s.address_line1,
        "address_line2": s.address_line2,
        "city": s.city,
        "country": s.country,
        "default_appointment_duration_minutes": s.default_appointment_duration_minutes,
        "appointment_slot_size_minutes": s.appointment_slot_size_minutes,
        "currency_code": s.currency_code,
        "currency_symbol": s.currency_symbol,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _serialize_wh(wh) -> dict:
    return {
        "id": str(wh.id),
        "day_of_week": wh.day_of_week,
        "is_working_day": wh.is_working_day,
        "morning_open": wh.morning_open.strftime("%H:%M") if wh.morning_open else None,
        "morning_close": wh.morning_close.strftime("%H:%M") if wh.morning_close else None,
        "afternoon_open": wh.afternoon_open.strftime("%H:%M") if wh.afternoon_open else None,
        "afternoon_close": wh.afternoon_close.strftime("%H:%M") if wh.afternoon_close else None,
    }


def _serialize_holiday(h) -> dict:
    return {
        "id": str(h.id),
        "date": h.date.isoformat(),
        "description": h.description,
    }


def _serialize_user(u, temp_password: str | None = None) -> dict:
    out = {
        "id": str(u.id),
        "clinic_id": str(u.clinic_id),
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "phone": u.phone,
        "is_active": u.is_active,
        "must_change_password": u.must_change_password,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }
    if temp_password is not None:
        out["temp_password"] = temp_password
    return out


# ─── Configuración ────────────────────────────────────────────────────────────

@settings_router.get("")
async def get_settings(
    user: Annotated[object, require_permission("view_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    config = await settings_service.get_clinic_config(db, user.clinic_id)
    return {
        "success": True,
        "data": {
            "settings": _serialize_settings(config["settings"]),
            "working_hours": [_serialize_wh(wh) for wh in config["working_hours"]],
            "upcoming_holidays": [_serialize_holiday(h) for h in config["holidays"]],
        },
    }


@settings_router.patch("")
async def update_settings(
    body: ClinicSettingsUpdate,
    user: Annotated[object, require_permission("manage_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    settings = await settings_service.update_clinic_settings(db, user.clinic_id, data)
    return {"success": True, "data": _serialize_settings(settings)}


@settings_router.put("/working-hours")
async def update_working_hours(
    body: WorkingHoursBulkUpdate,
    user: Annotated[object, require_permission("manage_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    entries = [e.model_dump() for e in body.hours]
    hours = await settings_service.bulk_update_working_hours(db, user.clinic_id, entries)
    return {"success": True, "data": [_serialize_wh(wh) for wh in hours]}


@settings_router.post("/holidays", status_code=201)
async def add_holiday(
    body: HolidayCreate,
    user: Annotated[object, require_permission("manage_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    holiday = await settings_service.add_holiday(
        db, user.clinic_id, body.date, body.description
    )
    return {"success": True, "data": _serialize_holiday(holiday)}


@settings_router.delete("/holidays/{holiday_id}", status_code=204)
async def delete_holiday(
    holiday_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_settings")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await settings_service.delete_holiday(db, user.clinic_id, holiday_id)


# ─── Usuarios ─────────────────────────────────────────────────────────────────

@users_router.get("")
async def list_users(
    user: Annotated[object, require_permission("view_users")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    users = await settings_service.list_users(db, user.clinic_id)
    return {"success": True, "data": [_serialize_user(u) for u in users]}


@users_router.post("", status_code=201)
async def create_user(
    body: UserCreate,
    user: Annotated[object, require_permission("manage_users")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump()
    new_user, temp_password = await settings_service.create_user(db, user.clinic_id, data)
    return {"success": True, "data": _serialize_user(new_user, temp_password)}


@users_router.get("/{user_id}")
async def get_user(
    user_id: uuid.UUID,
    user: Annotated[object, require_permission("view_users")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    target = await settings_service.get_user(db, user.clinic_id, user_id)
    return {"success": True, "data": _serialize_user(target)}


@users_router.patch("/{user_id}")
async def update_user(
    user_id: uuid.UUID,
    body: UserUpdate,
    user: Annotated[object, require_permission("manage_users")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude_none=True)
    updated = await settings_service.update_user(db, user.clinic_id, user_id, user.role, data)
    return {"success": True, "data": _serialize_user(updated)}


@users_router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: uuid.UUID,
    user: Annotated[object, require_permission("reset_user_passwords")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    target, temp_password = await settings_service.reset_user_password(
        db, user.clinic_id, user_id
    )
    return {"success": True, "data": _serialize_user(target, temp_password)}
