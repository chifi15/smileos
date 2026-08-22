from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.services import reports_service

router = APIRouter(prefix="/reports", tags=["Reportes"])


@router.get("/finances/summary")
async def finances_summary(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int = Query(...),
):
    data = await reports_service.get_full_summary(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/monthly-trend")
async def monthly_trend(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
):
    data = await reports_service.get_monthly_trend(db, user.clinic_id, year)
    return {"success": True, "data": data}


@router.get("/finances/top-procedures")
async def top_procedures(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_procedures(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-procedures-quoted")
async def top_procedures_quoted(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_procedures_quoted(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-expenses")
async def top_expenses(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_expenses(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/by-doctor")
async def by_doctor(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_doctor_report(db, user.clinic_id, year, month)
    return {"success": True, "data": data}


@router.get("/finances/top-patients")
async def top_patients(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    from app.services.finance_service import get_income_by_patient
    data = await get_income_by_patient(db, user.clinic_id, year, month)
    return {"success": True, "data": data[:10]}


@router.get("/finances/top-materials")
async def top_materials(
    user: Annotated[object, require_permission("view_patients")],
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int = Query(...),
    month: int | None = Query(default=None),
):
    data = await reports_service.get_top_materials(db, user.clinic_id, year, month)
    return {"success": True, "data": data}
