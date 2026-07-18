import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.config import get_settings
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
)
from app.models.user import User, RefreshToken

settings = get_settings()

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
