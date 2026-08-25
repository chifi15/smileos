import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.services import calendar_service

router = APIRouter(prefix="/calendar", tags=["Google Calendar"])


@router.get("/status")
async def get_status(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    status = await calendar_service.get_sync_status(db, user.clinic_id)
    return {"success": True, "data": status}


@router.post("/sync")
async def trigger_sync(
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await calendar_service.sync_calendar(db, user.clinic_id)
    return {"success": True, "data": result}


@router.get("/debug-raw")
async def debug_raw(
    user: Annotated[object, require_permission("manage_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Muestra las propiedades crudas de los primeros 3 eventos del iCal."""
    from sqlalchemy import select
    from app.models.clinic import ClinicSettings
    import httpx
    result = await db.execute(
        select(ClinicSettings.ical_url).where(ClinicSettings.clinic_id == user.clinic_id)
    )
    row = result.one_or_none()
    if not row or not row.ical_url:
        return {"success": False, "error": "Sin URL configurada"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(row.ical_url)
        raw = resp.text
    events = calendar_service._parse_ical(raw)
    return {"success": True, "data": events[:3]}


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
