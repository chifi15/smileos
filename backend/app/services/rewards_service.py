"""
Motor de puntos Smile Rewards.
Fuente de verdad de la lógica de acumulación y recálculo de nivel.
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, func

from app.models.rewards import (
    RewardsAccount, RewardsTransaction, RewardsConfig,
    POINTS_TABLE, LEVEL_THRESHOLDS,
)
from app.models.patient import Patient
from app.core.exceptions import NotFoundError, ValidationError, ConflictError

LEVEL_ORDER = ["starter", "bronze", "silver", "gold", "diamond"]

MANUAL_BONUS_TYPES = {"review", "birthday_visit", "consecutive_semesters"}

# Metadatos de tipos de sistema (no editables en clave, sí en puntos)
SYSTEM_TYPE_META: dict[str, dict] = {
    "visit":               {"label": "Visita",                    "trigger": "auto"},
    "cleaning":            {"label": "Limpieza",                   "trigger": "auto"},
    "treatment_completed": {"label": "Tratamiento completado",     "trigger": "auto"},
    "referral_completed":  {"label": "Referido completado",        "trigger": "auto"},
    "welcome":             {"label": "Bienvenida (primera visita)", "trigger": "auto"},
    "review":              {"label": "Reseña",                     "trigger": "manual"},
    "consecutive_semesters": {"label": "Fidelidad semestral",      "trigger": "manual"},
    "birthday_visit":      {"label": "Visita de cumpleaños",       "trigger": "manual"},
}

LEVEL_LABELS = {
    "starter": "Starter",
    "bronze":  "Bronce",
    "silver":  "Plata",
    "gold":    "Oro",
    "diamond": "Diamante",
}

DEFAULT_LEVEL_BENEFITS: dict[str, dict] = {
    "starter": {
        "discount_pct": 0,
        "perks": [],
    },
    "bronze": {
        "discount_pct": 5,
        "perks": [
            "5% de descuento en tratamientos",
            "Prioridad en agenda",
        ],
    },
    "silver": {
        "discount_pct": 10,
        "perks": [
            "10% de descuento en tratamientos",
            "Limpieza de cortesía anual",
            "Radiografía de diagnóstico gratis",
        ],
    },
    "gold": {
        "discount_pct": 15,
        "perks": [
            "15% de descuento en tratamientos",
            "Limpieza de cortesía semestral",
            "Blanqueamiento con descuento",
            "Revisión de emergencia prioritaria",
        ],
    },
    "diamond": {
        "discount_pct": 20,
        "perks": [
            "20% de descuento en todos los tratamientos",
            "Limpieza de cortesía trimestral",
            "Blanqueamiento gratuito anual",
            "Atención VIP de emergencia",
            "Consulta de seguimiento sin costo",
        ],
    },
}


# ─── Config efectiva ───────────────────────────────────────────────────────────

async def _load_config(db: AsyncSession, clinic_id: uuid.UUID) -> RewardsConfig | None:
    result = await db.execute(
        select(RewardsConfig).where(RewardsConfig.clinic_id == clinic_id)
    )
    return result.scalar_one_or_none()


async def get_effective_config(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Retorna la config efectiva: defaults + overrides de la clínica."""
    config = await _load_config(db, clinic_id)

    effective_points = dict(POINTS_TABLE)
    effective_thresholds = dict(LEVEL_THRESHOLDS)
    custom_types: dict = {}

    if config:
        effective_points.update(config.points_overrides)
        for key, ct in config.custom_types.items():
            effective_points[key] = ct["points"]
        effective_thresholds.update(config.level_overrides)
        custom_types = config.custom_types

    return {
        "points_table": effective_points,
        "level_thresholds": effective_thresholds,
        "custom_types": custom_types,
    }


async def get_rewards_config(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Formatea la config para la respuesta de la API."""
    config = await _load_config(db, clinic_id)

    points_overrides: dict = config.points_overrides if config else {}
    level_overrides: dict = config.level_overrides if config else {}
    custom_types: dict = config.custom_types if config else {}
    saved_benefits: dict = config.level_benefits if config else {}

    # Tabla de puntos (sistema + custom)
    points_table = []
    for key, meta in SYSTEM_TYPE_META.items():
        points_table.append({
            "key": key,
            "label": meta["label"],
            "points": points_overrides.get(key, POINTS_TABLE[key]),
            "is_system": True,
            "trigger": meta["trigger"],
        })
    for key, ct in custom_types.items():
        points_table.append({
            "key": key,
            "label": ct["label"],
            "points": ct["points"],
            "is_system": False,
            "trigger": "manual",
        })

    # Umbrales + beneficios por nivel
    level_thresholds = []
    for lvl in LEVEL_ORDER:
        default_b = DEFAULT_LEVEL_BENEFITS[lvl]
        saved_b = saved_benefits.get(lvl, {})
        level_thresholds.append({
            "level": lvl,
            "label": LEVEL_LABELS[lvl],
            "threshold": level_overrides.get(lvl, LEVEL_THRESHOLDS[lvl]),
            "is_editable": lvl != "starter",
            "discount_pct": saved_b.get("discount_pct", default_b["discount_pct"]),
            "perks": saved_b.get("perks", default_b["perks"]),
        })

    return {
        "points_table": points_table,
        "level_thresholds": level_thresholds,
    }


async def update_rewards_config(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    points_overrides: dict,
    level_overrides: dict,
    custom_types: dict,
    level_benefits: dict | None = None,
) -> dict:
    """Persiste los overrides de configuración (upsert)."""
    # Validar que los umbrales sean ascendentes
    thresholds = {**LEVEL_THRESHOLDS, **level_overrides}
    prev = -1
    for lvl in LEVEL_ORDER:
        v = thresholds[lvl]
        if v < prev:
            raise ValidationError("Los umbrales de nivel deben ser ascendentes.")
        prev = v

    # Validar que puntos sean >= 0
    for key, pts in points_overrides.items():
        if pts < 0:
            raise ValidationError(f"Los puntos para '{key}' no pueden ser negativos.")
    for key, ct in custom_types.items():
        if ct.get("points", 0) < 0:
            raise ValidationError(f"Los puntos para '{ct.get('label', key)}' no pueden ser negativos.")
        if not ct.get("label", "").strip():
            raise ValidationError("El nombre del tipo personalizado es obligatorio.")

    config = await _load_config(db, clinic_id)
    if config:
        config.points_overrides = points_overrides
        config.level_overrides = level_overrides
        config.custom_types = custom_types
        if level_benefits is not None:
            config.level_benefits = level_benefits
        config.updated_at = datetime.now(timezone.utc)
    else:
        config = RewardsConfig(
            clinic_id=clinic_id,
            points_overrides=points_overrides,
            level_overrides=level_overrides,
            custom_types=custom_types,
            level_benefits=level_benefits or {},
        )
        db.add(config)

    await db.flush()
    return await get_rewards_config(db, clinic_id)


# ─── Lógica de niveles ────────────────────────────────────────────────────────

def calculate_level(total_points: int, thresholds: dict | None = None) -> str:
    t = thresholds or LEVEL_THRESHOLDS
    level = "starter"
    for lvl, threshold in sorted(t.items(), key=lambda x: x[1], reverse=True):
        if total_points >= threshold:
            level = lvl
            break
    return level


def compute_level_progress(
    total_points: int,
    current_level: str,
    thresholds: dict | None = None,
) -> dict:
    t = thresholds or LEVEL_THRESHOLDS
    idx = LEVEL_ORDER.index(current_level)
    if idx == len(LEVEL_ORDER) - 1:
        return {
            "current_level": current_level,
            "next_level": None,
            "progress_pct": 100.0,
            "points_needed": None,
        }
    next_level = LEVEL_ORDER[idx + 1]
    next_threshold = t[next_level]
    current_threshold = t[current_level]
    range_size = max(1, next_threshold - current_threshold)
    points_in_range = max(0, total_points - current_threshold)
    progress = round(min(100.0, (points_in_range / range_size) * 100), 1)
    return {
        "current_level": current_level,
        "next_level": next_level,
        "progress_pct": progress,
        "points_needed": max(0, next_threshold - total_points),
    }


# ─── Helpers internos ─────────────────────────────────────────────────────────

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


# ─── Acumulación automática ───────────────────────────────────────────────────

async def accrue_appointment_rewards(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID,
    appointment_type: str,
    completed_at: datetime,
) -> None:
    account = await _get_account(db, patient_id)
    if not account:
        return

    cfg = await get_effective_config(db, clinic_id)
    pts = cfg["points_table"]
    thresholds = cfg["level_thresholds"]

    is_first_visit = account.last_visit_date is None

    await _add_transaction(db, account, appointment_id, "visit", pts.get("visit", POINTS_TABLE["visit"]))

    if appointment_type == "limpieza":
        await _add_transaction(db, account, appointment_id, "cleaning", pts.get("cleaning", POINTS_TABLE["cleaning"]))

    if is_first_visit:
        await _add_transaction(db, account, appointment_id, "welcome", pts.get("welcome", POINTS_TABLE["welcome"]))
        await db.execute(
            update(Patient)
            .where(Patient.id == patient_id)
            .values(first_visit_date=completed_at.date())
        )

    now = datetime.now(timezone.utc)
    account.last_visit_date = completed_at
    account.benefits_suspended = False
    old_level = account.level
    account.level = calculate_level(account.total_points, thresholds)
    if account.level != old_level:
        account.level_updated_at = now


async def accrue_treatment_rewards(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID | None,
) -> None:
    account = await _get_account(db, patient_id)
    if not account:
        return

    cfg = await get_effective_config(db, clinic_id)
    pts = cfg["points_table"]
    thresholds = cfg["level_thresholds"]

    await _add_transaction(
        db, account, appointment_id,
        "treatment_completed", pts.get("treatment_completed", POINTS_TABLE["treatment_completed"]),
    )

    old_level = account.level
    account.level = calculate_level(account.total_points, thresholds)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)


async def accrue_referral_rewards(
    db: AsyncSession,
    referrer_patient_id: uuid.UUID,
) -> None:
    account = await _get_account(db, referrer_patient_id)
    if not account:
        return

    # Para referidos no tenemos clinic_id aquí; usamos el de la cuenta
    clinic_id = account.clinic_id
    cfg = await get_effective_config(db, clinic_id)
    pts = cfg["points_table"]
    thresholds = cfg["level_thresholds"]

    await _add_transaction(
        db, account, None,
        "referral_completed", pts.get("referral_completed", POINTS_TABLE["referral_completed"]),
    )

    old_level = account.level
    account.level = calculate_level(account.total_points, thresholds)
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)


# ─── Consultas ────────────────────────────────────────────────────────────────

async def _expire_points_if_needed(
    db: AsyncSession,
    account: RewardsAccount,
    last_visit_dt: datetime,
) -> bool:
    """
    Verifica si los puntos ya fueron expirados desde la última visita.
    Si no, los pone a cero y registra la transacción. Retorna True si expiró.
    """
    if account.total_points <= 0:
        return False

    # Evitar duplicar la expiración: busca si ya existe una tx "points_expired"
    # creada DESPUÉS de la última visita
    already = await db.execute(
        select(RewardsTransaction).where(
            RewardsTransaction.account_id == account.id,
            RewardsTransaction.transaction_type == "points_expired",
            RewardsTransaction.created_at > last_visit_dt,
        ).limit(1)
    )
    if already.scalar_one_or_none():
        return False

    # Expirar
    points_to_remove = -account.total_points
    db.add(RewardsTransaction(
        clinic_id=account.clinic_id,
        account_id=account.id,
        appointment_id=None,
        transaction_type="points_expired",
        points=points_to_remove,
        balance_after=0,
        description="Puntos vencidos automáticamente por inactividad mayor a 12 meses.",
    ))
    account.total_points = 0
    account.level = "starter"
    account.benefits_suspended = True
    account.level_updated_at = datetime.now(timezone.utc)
    return True


async def expire_points_manual(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
) -> RewardsAccount:
    """Expira los puntos de un paciente manualmente (independiente del tiempo de inactividad)."""
    result = await db.execute(
        select(RewardsAccount).where(
            RewardsAccount.patient_id == patient_id,
            RewardsAccount.clinic_id == clinic_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise NotFoundError("Cuenta Smile Rewards")

    if account.total_points <= 0:
        raise ValidationError("El paciente no tiene puntos que expirar.")

    points_to_remove = -account.total_points
    db.add(RewardsTransaction(
        clinic_id=account.clinic_id,
        account_id=account.id,
        appointment_id=None,
        transaction_type="points_expired",
        points=points_to_remove,
        balance_after=0,
        description="Puntos vencidos manualmente por el administrador.",
    ))
    account.total_points = 0
    account.level = "starter"
    account.benefits_suspended = True
    account.level_updated_at = datetime.now(timezone.utc)
    await db.flush()
    return account


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

    if account.last_visit_date:
        cutoff = datetime.now(timezone.utc) - timedelta(days=365)
        lv = account.last_visit_date
        if lv.tzinfo is None:
            lv = lv.replace(tzinfo=timezone.utc)
        if lv < cutoff:
            account.benefits_suspended = True
            await _expire_points_if_needed(db, account, lv)

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


# ─── Acciones manuales ────────────────────────────────────────────────────────

async def grant_bonus(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    bonus_type: str,
    appointment_id: uuid.UUID | None,
) -> RewardsAccount:
    cfg = await get_effective_config(db, clinic_id)
    allowed = MANUAL_BONUS_TYPES | set(cfg["custom_types"].keys())
    if bonus_type not in allowed:
        raise ValidationError(f"Tipo de bono no válido: {bonus_type}.")

    account = await get_account_for_patient(db, clinic_id, patient_id)
    points = cfg["points_table"].get(bonus_type, 0)

    await _add_transaction(db, account, appointment_id, bonus_type, points)

    old_level = account.level
    account.level = calculate_level(account.total_points, cfg["level_thresholds"])
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
    cfg = await get_effective_config(db, clinic_id)
    account = await get_account_for_patient(db, clinic_id, patient_id)

    if account.total_points + points < 0:
        raise ValidationError(
            f"El ajuste dejaría el saldo en negativo. "
            f"Saldo actual: {account.total_points} pts."
        )

    await _add_transaction(db, account, None, "adjustment", points, description)

    old_level = account.level
    account.level = calculate_level(account.total_points, cfg["level_thresholds"])
    if account.level != old_level:
        account.level_updated_at = datetime.now(timezone.utc)

    await db.flush()
    return await get_account_for_patient(db, clinic_id, patient_id)
