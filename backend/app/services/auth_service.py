import hashlib
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
)
from app.models.clinic import Clinic, ClinicSettings
from app.models.user import User, RefreshToken

settings = get_settings()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[áàäâ]", "a", text)
    text = re.sub(r"[éèëê]", "e", text)
    text = re.sub(r"[íìïî]", "i", text)
    text = re.sub(r"[óòöô]", "o", text)
    text = re.sub(r"[úùüû]", "u", text)
    text = re.sub(r"ñ", "n", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s-]+", "-", text).strip("-")
    return text[:60]


async def register_clinic(
    db: AsyncSession,
    clinic_name: str,
    full_name: str,
    email: str,
    password: str,
) -> User:
    email = email.lower()

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        from app.core.exceptions import ConflictError
        raise ConflictError("Ya existe una cuenta con ese correo electrónico.")

    base_slug = _slugify(clinic_name)
    suffix = secrets.token_hex(3)
    slug = f"{base_slug}-{suffix}"

    clinic = Clinic(name=clinic_name, slug=slug, is_active=True)
    db.add(clinic)
    await db.flush()

    clinic_settings = ClinicSettings(
        clinic_id=clinic.id,
        display_name=clinic_name,
    )
    db.add(clinic_settings)

    user = User(
        clinic_id=clinic.id,
        email=email,
        password_hash=hash_password(password),
        full_name=full_name,
        role="clinic_owner",
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    await db.flush()

    return user

REFRESH_TOKEN_COOKIE = "smileos_refresh"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    result = await db.execute(
        select(User).where(User.email == email.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        return None
    return user


async def issue_tokens(db: AsyncSession, user: User) -> tuple[str, str]:
    """Crea un par access/refresh token. Retorna (access_token, refresh_token_raw)."""
    payload = {
        "sub": str(user.id),
        "clinic_id": str(user.clinic_id),
        "role": user.role,
        "email": user.email,
    }
    access_token = create_access_token(payload)

    raw_refresh = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    db.add(RefreshToken(
        user_id=user.id,
        token_hash=_hash_token(raw_refresh),
        expires_at=expires_at,
        revoked=False,
    ))

    # Actualizar último login
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(last_login_at=datetime.now(timezone.utc))
    )

    return access_token, raw_refresh


async def rotate_refresh_token(
    db: AsyncSession, raw_token: str
) -> tuple[str, str, User] | None:
    """Valida el refresh token, lo revoca y emite un par nuevo. Retorna None si inválido."""
    token_hash = _hash_token(raw_token)

    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked == False,
        )
    )
    stored = result.scalar_one_or_none()

    if not stored:
        return None

    if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    # Revocar el token usado (rotación)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.id == stored.id)
        .values(revoked=True)
    )

    # Cargar el usuario
    result = await db.execute(
        select(User).where(User.id == stored.user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        return None

    access_token, new_raw_refresh = await issue_tokens(db, user)
    return access_token, new_raw_refresh, user


async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hash = _hash_token(raw_token)
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash)
        .values(revoked=True)
    )


async def revoke_all_user_tokens(db: AsyncSession, user_id) -> None:
    """Revoca todos los refresh tokens del usuario. Usado al cambiar contraseña."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
        .values(revoked=True)
    )


async def find_or_create_google_user(db: AsyncSession, email: str, full_name: str) -> User:
    email = email.lower()
    result = await db.execute(
        select(User).where(User.email == email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user:
        return user

    # Nueva cuenta — crear clínica + usuario
    base_slug = _slugify(full_name)
    suffix = secrets.token_hex(3)
    slug = f"{base_slug}-{suffix}"

    clinic = Clinic(name=full_name, slug=slug, is_active=True)
    db.add(clinic)
    await db.flush()

    db.add(ClinicSettings(clinic_id=clinic.id, display_name=full_name))

    user = User(
        clinic_id=clinic.id,
        email=email,
        password_hash=hash_password(secrets.token_urlsafe(32)),
        full_name=full_name,
        role="clinic_owner",
        is_active=True,
        must_change_password=False,
    )
    db.add(user)
    await db.flush()
    return user


async def create_reset_token(db: AsyncSession, email: str) -> tuple[str, User] | None:
    result = await db.execute(
        select(User).where(User.email == email.lower(), User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user:
        return None

    raw_token = secrets.token_urlsafe(48)
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

    await db.execute(
        sa.text(
            "INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used) "
            "VALUES (gen_random_uuid(), :user_id, :token_hash, :expires_at, false)"
        ),
        {"user_id": user.id, "token_hash": token_hash, "expires_at": expires_at},
    )
    return raw_token, user


async def reset_password_with_token(db: AsyncSession, raw_token: str, new_password: str) -> bool:
    token_hash = _hash_token(raw_token)
    logger.info(f"Buscando token hash: {token_hash[:16]}...")

    result = await db.execute(
        sa.text(
            "SELECT id, user_id, expires_at, used FROM password_reset_tokens "
            "WHERE token_hash = :token_hash"
        ),
        {"token_hash": token_hash},
    )
    row = result.mappings().one_or_none()

    if not row:
        logger.error("Token no encontrado en DB")
        return False
    if row["used"]:
        logger.error("Token ya fue usado")
        return False

    expires_at = row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        logger.error(f"Token expirado: {expires_at}")
        return False

    await db.execute(
        sa.text("UPDATE password_reset_tokens SET used = true WHERE id = :id"),
        {"id": row["id"]},
    )
    await db.execute(
        update(User)
        .where(User.id == row["user_id"])
        .values(password_hash=hash_password(new_password))
    )
    await revoke_all_user_tokens(db, row["user_id"])
    return True


async def change_password(
    db: AsyncSession, user: User, current_password: str, new_password: str
) -> bool:
    if not verify_password(current_password, user.password_hash):
        return False

    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(
            password_hash=hash_password(new_password),
            must_change_password=False,
        )
    )
    await revoke_all_user_tokens(db, user.id)
    return True
