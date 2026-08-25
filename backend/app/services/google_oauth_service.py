"""
Google Calendar OAuth 2.0 + Calendar API.
Usa httpx directamente, sin dependencias de google-auth.
"""
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.clinic import ClinicSettings
from app.core.config import get_settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPES = "https://www.googleapis.com/auth/calendar"


def _settings():
    return get_settings()


def get_redirect_uri() -> str:
    return "https://smileos.onrender.com/api/v1/calendar/oauth/callback"


def build_auth_url(state: str) -> str:
    params = {
        "client_id": _settings().google_client_id,
        "redirect_uri": get_redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str) -> dict:
    """Intercambia el código de autorización por tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": _settings().google_client_id,
            "client_secret": _settings().google_client_secret,
            "redirect_uri": get_redirect_uri(),
            "grant_type": "authorization_code",
        })
        resp.raise_for_status()
        return resp.json()


async def refresh_access_token(refresh_token: str) -> str:
    """Obtiene un nuevo access_token usando el refresh_token."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "refresh_token": refresh_token,
            "client_id": _settings().google_client_id,
            "client_secret": _settings().google_client_secret,
            "grant_type": "refresh_token",
        })
        resp.raise_for_status()
        data = resp.json()
        return data["access_token"]


async def get_access_token(db: AsyncSession, clinic_id: uuid.UUID) -> str | None:
    """Devuelve un access_token válido para la clínica."""
    result = await db.execute(
        select(ClinicSettings.google_refresh_token)
        .where(ClinicSettings.clinic_id == clinic_id)
    )
    row = result.one_or_none()
    if not row or not row.google_refresh_token:
        return None
    return await refresh_access_token(row.google_refresh_token)


async def get_primary_calendar_id(access_token: str) -> str:
    """Obtiene el ID del calendario primario del usuario."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/calendars/primary",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()["id"]


# ─── Calendar operations ───────────────────────────────────────────────────────

async def create_google_event(
    access_token: str,
    calendar_id: str,
    summary: str,
    start_dt: datetime,
    end_dt: datetime,
    description: str = "",
    color_id: str | None = None,
) -> dict:
    """Crea un evento en Google Calendar y retorna el evento creado."""
    body = {
        "summary": summary,
        "description": description,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/Managua"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/Managua"},
        "extendedProperties": {"private": {"smileos": "1"}},
    }
    if color_id:
        body["colorId"] = color_id
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
            headers={"Authorization": f"Bearer {access_token}"},
            json=body,
        )
        resp.raise_for_status()
        return resp.json()


async def update_google_event(
    access_token: str,
    calendar_id: str,
    google_event_id: str,
    summary: str,
    start_dt: datetime,
    end_dt: datetime,
) -> dict:
    body = {
        "summary": summary,
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/Managua"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/Managua"},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{google_event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            json=body,
        )
        resp.raise_for_status()
        return resp.json()


async def delete_google_event(
    access_token: str,
    calendar_id: str,
    google_event_id: str,
) -> None:
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events/{google_event_id}",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code not in (200, 204, 410):
            resp.raise_for_status()


async def get_event_colors(access_token: str) -> dict[str, str]:
    """Devuelve el mapa colorId → hex exacto según la API de Google Calendar."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/colors",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.is_success:
            event_section = resp.json().get("event", {})
            return {k: v.get("background", "") for k, v in event_section.items()}
    return {}


async def list_google_events(
    access_token: str,
    calendar_id: str,
    time_min: datetime,
    time_max: datetime,
) -> list[dict]:
    """Lista eventos de Google Calendar en un rango de fechas."""
    params = {
        "timeMin": time_min.isoformat(),
        "timeMax": time_max.isoformat(),
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 2500,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/calendars/{calendar_id}/events",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
        )
        if not resp.is_success:
            raise httpx.HTTPStatusError(
                f"{resp.status_code} {resp.reason_phrase}: {resp.text}",
                request=resp.request,
                response=resp,
            )
        return resp.json().get("items", [])


# ─── Color mapping ─────────────────────────────────────────────────────────────

GCAL_COLOR_IDS = {
    "1": "#D50000",   # tomato
    "2": "#E67C73",   # flamingo
    "3": "#F4511E",   # tangerine
    "4": "#F6BF26",   # banana
    "5": "#33B679",   # sage
    "6": "#0B8043",   # basil
    "7": "#039BE5",   # peacock
    "8": "#3F51B5",   # blueberry
    "9": "#7986CB",   # lavender
    "10": "#8E24AA",  # grape
    "11": "#616161",  # graphite
}


def resolve_color_id(color_id: str | None) -> str | None:
    if not color_id:
        return None
    return GCAL_COLOR_IDS.get(str(color_id))
