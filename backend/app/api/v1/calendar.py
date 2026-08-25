import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.core.config import get_settings
from app.models.clinic import ClinicSettings
from app.models.calendar import CalendarEvent
from app.services import calendar_service, google_oauth_service as oauth

router = APIRouter(prefix="/calendar", tags=["Google Calendar"])


# ─── OAuth flow ────────────────────────────────────────────────────────────────

@router.get("/oauth/authorize")
async def oauth_authorize(
    user: Annotated[object, require_permission("manage_patients")],
):
    """Devuelve la URL de consentimiento de Google (el frontend redirige)."""
    if not get_settings().google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth no configurado en el servidor.")
    state = str(user.clinic_id)
    url = oauth.build_auth_url(state)
    return {"success": True, "data": {"url": url}}


@router.get("/oauth/callback")
async def oauth_callback(
    code: str,
    state: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Google redirige aquí tras el consentimiento. Guarda el refresh_token."""
    try:
        tokens = await oauth.exchange_code(code)
    except Exception:
        return RedirectResponse(f"{get_settings().frontend_url}/settings?google=error")

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        return RedirectResponse(f"{get_settings().frontend_url}/settings?google=error")

    # Obtener calendar ID primario
    access_token = tokens.get("access_token", "")
    try:
        calendar_id = await oauth.get_primary_calendar_id(access_token)
    except Exception:
        calendar_id = "primary"

    clinic_id = uuid.UUID(state)
    result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        return RedirectResponse(f"{get_settings().frontend_url}/settings?google=error")

    settings.google_refresh_token = refresh_token
    settings.google_calendar_id = calendar_id
    await db.commit()

    return RedirectResponse(f"{get_settings().frontend_url}/settings?google=connected")


@router.delete("/oauth/disconnect")
async def oauth_disconnect(
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.clinic_id == user.clinic_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        settings.google_refresh_token = None
        settings.google_calendar_id = None
        await db.commit()
    return {"success": True}


# ─── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def get_status(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(
            ClinicSettings.ical_url,
            ClinicSettings.calendar_last_synced_at,
            ClinicSettings.google_refresh_token,
            ClinicSettings.google_calendar_id,
        ).where(ClinicSettings.clinic_id == user.clinic_id)
    )
    row = result.one_or_none()
    oauth_configured = get_settings().google_client_id != ""
    return {
        "success": True,
        "data": {
            "configured": bool(row and (row.ical_url or row.google_refresh_token)),
            "oauth_connected": bool(row and row.google_refresh_token),
            "oauth_available": oauth_configured,
            "calendar_id": row.google_calendar_id if row else None,
            "last_synced_at": row.calendar_last_synced_at.isoformat() if row and row.calendar_last_synced_at else None,
        },
    }


# ─── Sync ──────────────────────────────────────────────────────────────────────

@router.get("/event-colors")
async def get_event_colors(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Devuelve el mapa colorId→hex exacto desde la API de Google Calendar."""
    access_token = await oauth.get_access_token(db, user.clinic_id)
    if not access_token:
        return {"success": True, "data": {}}
    colors = await oauth.get_event_colors(access_token)
    return {"success": True, "data": colors}


@router.post("/sync")
async def trigger_sync(
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await calendar_service.sync_calendar(db, user.clinic_id)
    return {"success": True, "data": result}


# ─── Events ────────────────────────────────────────────────────────────────────

@router.get("/events")
async def get_events(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
):
    events = await calendar_service.get_events(
        db, user.clinic_id, date_from, date_to, auto_sync=True
    )
    return {"success": True, "data": events}


class CreateGcalEventBody(BaseModel):
    summary: str
    start_at: datetime
    end_at: datetime
    description: str = ""


@router.post("/events")
async def create_gcal_event(
    body: CreateGcalEventBody,
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Crea un evento en Google Calendar (requiere OAuth conectado)."""
    access_token = await oauth.get_access_token(db, user.clinic_id)
    if not access_token:
        raise HTTPException(status_code=400, detail="Google Calendar no está conectado con OAuth.")

    result = await db.execute(
        select(ClinicSettings.google_calendar_id).where(ClinicSettings.clinic_id == user.clinic_id)
    )
    cal_id = result.scalar_one_or_none() or "primary"

    gcal_event = await oauth.create_google_event(
        access_token, cal_id,
        body.summary, body.start_at, body.end_at, body.description,
    )

    # Guardar en calendar_events localmente
    now = datetime.now(timezone.utc)
    ev = CalendarEvent(
        clinic_id=user.clinic_id,
        ical_uid=gcal_event["id"],
        google_event_id=gcal_event["id"],
        title=body.summary,
        start_at=body.start_at,
        end_at=body.end_at,
        gcal_color=None,
        created_at=now,
        updated_at=now,
    )
    db.add(ev)
    await db.commit()

    return {"success": True, "data": {"google_event_id": gcal_event["id"]}}
