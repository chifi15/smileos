from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_permission
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("")
async def get_dashboard(
    user: Annotated[object, require_permission("view_dashboard")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    KPIs principales del dashboard.
    Ejecuta todas las consultas en la misma sesión de base de datos.
    """
    today = await dashboard_service.get_today_stats(db, user.clinic_id)
    weekly = await dashboard_service.get_weekly_stats(db, user.clinic_id)
    patients = await dashboard_service.get_patient_stats(db, user.clinic_id)
    treatments = await dashboard_service.get_treatment_stats(db, user.clinic_id)
    rewards = await dashboard_service.get_rewards_stats(db, user.clinic_id)

    return {
        "success": True,
        "data": {
            "today": today,
            "last_7_days": weekly,
            "patients": patients,
            "treatment_plans": treatments,
            "smile_rewards": rewards,
        },
    }


@router.get("/schedule")
async def get_todays_schedule(
    user: Annotated[object, require_permission("view_dashboard")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Agenda del día de hoy (sin citas canceladas), ordenada por hora."""
    schedule = await dashboard_service.get_todays_schedule(db, user.clinic_id)
    return {"success": True, "data": schedule}
