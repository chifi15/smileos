"""
Motor de puntos Smile Rewards.
Fuente de verdad de la lógica de acumulación y recálculo de nivel.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func

from app.models.rewards import (
    RewardsAccount, RewardsTransaction,
    POINTS_TABLE, LEVEL_THRESHOLDS,
)
from app.models.patient import Patient
from app.core.exceptions import NotFoundError, ValidationError, ConflictError

LEVEL_ORDER = ["starter", "bronze", "silver", "gold", "diamond"]

# Tipos de bonos que se pueden otorgar manualmente
MANUAL_BONUS_TYPES = {"review", "birthday_visit", "consecutive_semesters"}


def calculate_level(total_points: int) -> str:
    level = "starter"
    for lvl, threshold in sorted(LEVEL_THRESHOLDS.items(), key=lambda x: x[1], reverse=True):
        if total_points >= threshold:
            level = lvl
            break
    return level


async def _get_account(db: AsyncSession, patient_id: uuid.UUID) -> RewardsAccount | None:
    result = await db.execute(
        select(RewardsAccount).where(RewardsAccount.patient_id == patient_id)
    )
    return result.scalar_one_or_none()


async def _add_transaction(
    db: AsyncSession,
    account: RewardsAccount,
    appointment_id: uuid.UUID | None,
    tx_type: str,
    points: int,
    description: str | None = None,
) -> None:
    account.total_points += points
    db.add(RewardsTransaction(
        clinic_id=account.clinic_id,
        account_id=account.id,
        appointment_id=appointment_id,
        transaction_type=tx_type,
        points=points,
        balance_after=account.total_points,
        description=description,
    ))


async def accrue_appointment_rewards(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID,
    appointment_type: str,
    completed_at: datetime,
) -> None:
    """
    Acumula puntos al completar una cita.
    La constraint UNIQUE(appointment_id, transaction_type) en la tabla
    rewards_transactions garantiza idempotencia si se llama dos veces.
    """
    account = await _get_account(db, patient_id)
    if not account:
        return

    # Verificar si es la primera visita completada
    is_first_visit = account.last_visit_date is None

    # Puntos base por visita
    await _add_transaction(db, account, appointment_id, "visit", POINTS_TABLE["visit"])

    # Puntos por limpieza
    if appointment_type == "limpieza":
        await _add_transaction(db, account, appointment_id, "cleaning", POINTS_TABLE["cleaning"])

    # Bono de bienvenida en primera visita
    if is_first_visit:
        await _add_transaction(db, account, appointment_id, "welcome", POINTS_TABLE["welcome"])
        # Registrar fecha de primera visita en el paciente
        await db.execute(
            update(Patient)
            .where(Patient.id == patient_id)
            .values(first_visit_date=completed_at.date())
        )

    # Actualizar cuenta
    now = datetime.now(timezone.utc)
    account.last_visit_date = completed_at
    account.benefits_suspended = False
    old_level = account.level
    account.level = calculate_level(account.total_points)
    if account.level != old_level:
        account.level_updated_at = now


async def accrue_treatment_rewards(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID,
) -> None:
    """Acumula puntos al completar un ítem de tratamiento dentro de una cita."""
    account = await _get_account(db, patient_id)
    if not account:
        return

    await _add_transaction(
        db, account, appointment_id,
        "treatment_completed", POINTS_TABLE["treatment_completed"],
    )

    old_level = account.level
    account.level = calculate_level(account.total_points)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)


async def accrue_referral_rewards(
    db: AsyncSession,
    referrer_patient_id: uuid.UUID,
) -> None:
    """Acumula puntos al referidor cuando el paciente referido completa un tratamiento."""
    account = await _get_account(db, referrer_patient_id)
    if not account:
        return

    await _add_transaction(
        db, account, None,
        "referral_completed", POINTS_TABLE["referral_completed"],
    )

    old_level = account.level
    account.level = calculate_level(account.total_points)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)


# ─── Consulta ─────────────────────────────────────────────────────────────────

def compute_level_progress(total_points: int, current_level: str) -> dict:
    idx = LEVEL_ORDER.index(current_level)
    if idx == len(LEVEL_ORDER) - 1:
        return {
            "current_level": current_level,
            "current_points": total_points,
            "next_level": None,
            "next_level_threshold": None,
            "points_to_next_level": 0,
            "progress_percent": 100.0,
        }
    next_level = LEVEL_ORDER[idx + 1]
    next_threshold = LEVEL_THRESHOLDS[next_level]
    current_threshold = LEVEL_THRESHOLDS[current_level]
    range_size = next_threshold - current_threshold
    points_in_range = max(0, total_points - current_threshold)
    progress = round(min(100.0, (points_in_range / range_size) * 100), 1)
    return {
        "current_level": current_level,
        "current_points": total_points,
        "next_level": next_level,
        "next_level_threshold": next_threshold,
        "points_to_next_level": max(0, next_threshold - total_points),
        "progress_percent": progress,
    }


async def get_account_for_patient(
    db: AsyncSession, clinic_id: uuid.UUID, patient_id: uuid.UUID
) -> RewardsAccount:
    result = await db.execute(
        select(RewardsAccount).where(
            RewardsAccount.patient_id == patient_id,
            RewardsAccount.clinic_id == clinic_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Cuenta Smile Rewards")

    # Verificar suspensión por inactividad (>12 meses sin visita)
    if account.last_visit_date:
        cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        lv = account.last_visit_date
        if lv.tzinfo is None:
            lv = lv.replace(tzinfo=timezone.utc)
        if lv < cutoff and not account.benefits_suspended:
            account.benefits_suspended = True

    return account


async def get_transactions(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    page: int = 1,
    per_page: int = 20,
) -> tuple[list[RewardsTransaction], int]:
    account = await get_account_for_patient(db, clinic_id, patient_id)

    base = select(RewardsTransaction).where(
        RewardsTransaction.account_id == account.id
    )
    total: int = await db.scalar(select(func.count()).select_from(base.subquery())) or 0

    result = await db.execute(
        base.order_by(desc(RewardsTransaction.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return list(result.scalars().all()), total


# ─── Acciones ─────────────────────────────────────────────────────────────────

async def grant_bonus(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    bonus_type: str,
    appointment_id: uuid.UUID | None,
) -> RewardsAccount:
    if bonus_type not in MANUAL_BONUS_TYPES:
        raise ValidationError(f"Tipo de bono no válido: {bonus_type}.")

    account = await get_account_for_patient(db, clinic_id, patient_id)
    points = POINTS_TABLE[bonus_type]

    await _add_transaction(db, account, appointment_id, bonus_type, points)

    old_level = account.level
    account.level = calculate_level(account.total_points)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)

    await db.flush()
    return await get_account_for_patient(db, clinic_id, patient_id)


async def manual_adjust(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    points: int,
    description: str,
) -> RewardsAccount:
    account = await get_account_for_patient(db, clinic_id, patient_id)

    # Impedir que el balance quede negativo
    if account.total_points + points < 0:
        raise ValidationError(
            f"El ajuste dejaría el saldo en negativo. "
            f"Saldo actual: {account.total_points} pts."
        )

    await _add_transaction(db, account, None, "adjustment", points, description)

    old_level = account.level
    account.level = calculate_level(account.total_points)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)

    await db.flush()
    return await get_account_for_patient(db, clinic_id, patient_id)
