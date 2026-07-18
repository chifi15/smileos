import hashlib
from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_token
from app.core.permissions import has_permission
from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.models.user import User

settings = get_settings()
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    if not credentials:
        raise UnauthorizedError("Token de autenticación requerido.")

    try:
        payload = decode_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Token inválido o expirado.")

    if payload.get("type") != "access":
        raise UnauthorizedError("Tipo de token incorrecto.")

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise UnauthorizedError("Token malformado.")

    result = await db.execute(
        select(User).where(User.id == user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise UnauthorizedError("Usuario no encontrado o inactivo.")

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_permission(permission: str):
    """Factory que retorna una dependencia que exige un permiso específico."""

    async def _check(user: CurrentUser) -> User:
        if not has_permission(user.role, permission):
            raise ForbiddenError()
        return user

    return Depends(_check)
