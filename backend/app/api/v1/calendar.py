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
