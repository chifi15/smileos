import uuid
import math
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_permission
from app.schemas.rewards import GrantBonusRequest, ManualAdjustRequest, RewardsConfigUpdate
from app.services import rewards_service

router = APIRouter(prefix="/patients/{patient_id}/rewards", tags=["Smile Rewards"])


def _iso(dt):
    return dt.isoformat() if dt else None


def _serialize_account(account, thresholds: dict | None = None) -> dict:
    progress = rewards_service.compute_level_progress(account.total_points, account.level, thresholds)
    return {
        "id": str(account.id),
        "patient_id": str(account.patient_id),
        "level": account.level,
        "total_points": account.total_points,
        "benefits_suspended": account.benefits_suspended,
        "last_visit_date": _iso(account.last_visit_date),
        "level_updated_at": _iso(account.level_updated_at),
        "progress": progress,
    }


def _serialize_tx(tx) -> dict:
    return {
        "id": str(tx.id),
        "transaction_type": tx.transaction_type,
        "points": tx.points,
        "balance_after": tx.balance_after,
        "description": tx.description,
        "appointment_id": str(tx.appointment_id) if tx.appointment_id else None,
        "created_at": _iso(tx.created_at),
    }


@router.get("")
async def get_rewards_account(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cfg = await rewards_service.get_effective_config(db, user.clinic_id)
    account = await rewards_service.get_account_for_patient(db, user.clinic_id, patient_id)
    return {"success": True, "data": _serialize_account(account, cfg["level_thresholds"])}


@router.get("/transactions")
async def get_transactions(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("view_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=50),
):
    transactions, total = await rewards_service.get_transactions(
        db, user.clinic_id, patient_id, page, per_page
    )
    return {
        "success": True,
        "data": [_serialize_tx(t) for t in transactions],
        "meta": {
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0,
        },
    }


@router.post("/bonus")
async def grant_bonus(
    patient_id: uuid.UUID,
    body: GrantBonusRequest,
    user: Annotated[object, require_permission("manage_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await rewards_service.grant_bonus(
        db, user.clinic_id, patient_id, body.bonus_type, body.appointment_id
    )
    cfg = await rewards_service.get_effective_config(db, user.clinic_id)
    points_given = cfg["points_table"].get(body.bonus_type, 0)
    return {
        "success": True,
        "data": {
            "message": f"Bono '{body.bonus_type}' acreditado: +{points_given} pts.",
            "account": _serialize_account(account, cfg["level_thresholds"]),
        },
    }


@router.post("/expire")
async def expire_rewards_points(
    patient_id: uuid.UUID,
    user: Annotated[object, require_permission("manage_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    cfg = await rewards_service.get_effective_config(db, user.clinic_id)
    account = await rewards_service.expire_points_manual(db, user.clinic_id, patient_id)
    return {
        "success": True,
        "data": {
            "message": "Puntos expirados. El paciente regresa al nivel Starter.",
            "account": _serialize_account(account, cfg["level_thresholds"]),
        },
    }


@router.post("/adjust")
async def manual_adjust(
    patient_id: uuid.UUID,
    body: ManualAdjustRequest,
    user: Annotated[object, require_permission("manage_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = await rewards_service.manual_adjust(
        db, user.clinic_id, patient_id, body.points, body.description
    )
    cfg = await rewards_service.get_effective_config(db, user.clinic_id)
    sign = "+" if body.points > 0 else ""
    return {
        "success": True,
        "data": {
            "message": f"Ajuste aplicado: {sign}{body.points} pts.",
            "account": _serialize_account(account, cfg["level_thresholds"]),
        },
    }


# ─── Endpoints globales del programa ─────────────────────────────────────────

levels_router = APIRouter(prefix="/rewards", tags=["Smile Rewards"])


@levels_router.get("/config")
async def get_rewards_config(
    user: Annotated[object, require_permission("view_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = await rewards_service.get_rewards_config(db, user.clinic_id)
    return {"success": True, "data": data}


@levels_router.put("/config")
async def update_rewards_config(
    body: RewardsConfigUpdate,
    user: Annotated[object, require_permission("manage_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    custom_types_dict = {k: v.model_dump() for k, v in body.custom_types.items()}
    level_benefits_dict = {k: v.model_dump() for k, v in body.level_benefits.items()}
    data = await rewards_service.update_rewards_config(
        db,
        user.clinic_id,
        body.points_overrides,
        body.level_overrides,
        custom_types_dict,
        level_benefits_dict if level_benefits_dict else None,
    )
    return {"success": True, "data": data}


@levels_router.get("/levels")
async def get_levels_info(
    user: Annotated[object, require_permission("view_rewards")],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Compatibilidad: retorna config completa en formato legado."""
    data = await rewards_service.get_rewards_config(db, user.clinic_id)
    return {"success": True, "data": data}
