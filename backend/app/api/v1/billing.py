from typing import Annotated
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.models.clinic import Clinic
from app.models.patient import Patient
from app.core.plans import PLANS, DEFAULT_PLAN

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/plan")
async def get_plan(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    clinic = await db.scalar(select(Clinic).where(Clinic.id == user.clinic_id))
    plan_key = (clinic.plan if clinic else DEFAULT_PLAN) or DEFAULT_PLAN
    plan_cfg = PLANS.get(plan_key, PLANS[DEFAULT_PLAN])

    # Si el plan de pago expiró, degradar a free en la respuesta
    is_expired = False
    if clinic and clinic.plan_expires_at and plan_key != "free":
        if clinic.plan_expires_at < datetime.now(timezone.utc):
            plan_key = "free"
            plan_cfg = PLANS["free"]
            is_expired = True

    patient_count = await db.scalar(
        select(func.count()).where(
            Patient.clinic_id == user.clinic_id,
            Patient.is_active == True,  # noqa: E712
        )
    ) or 0

    limit = plan_cfg["patient_limit"]

    return {
        "success": True,
        "data": {
            "plan": plan_key,
            "plan_name": plan_cfg["name"],
            "price_usd": plan_cfg["price_usd"],
            "patient_count": patient_count,
            "patient_limit": limit,
            "is_expired": is_expired,
            "plan_expires_at": clinic.plan_expires_at.isoformat() if clinic and clinic.plan_expires_at else None,
        },
    }
