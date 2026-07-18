"""
Motor de puntos Smile Rewards.
Fuente de verdad de la lógica de acumulación y recálculo de nivel.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.rewards import (
    RewardsAccount, RewardsTransaction,
    POINTS_TABLE, LEVEL_THRESHOLDS,
)
from app.models.patient import Patient


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
