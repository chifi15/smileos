from datetime import timedelta

from fastapi import APIRouter, Response, Request, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.core.config import get_settings
from app.core.database import get_db
from app.core.dependencies import CurrentUser
from app.core.exceptions import UnauthorizedError, ValidationError
from app.schemas.auth import (
    LoginRequest, LoginResponse, RefreshResponse,
    ChangePasswordRequest, UserOut,
)
from app.services.auth_service import (
    authenticate_user, issue_tokens, rotate_refresh_token,
    revoke_refresh_token, change_password, REFRESH_TOKEN_COOKIE,
)

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["Autenticación"])

_COOKIE_MAX_AGE = int(timedelta(days=settings.refresh_token_expire_days).total_seconds())


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_TOKEN_COOKIE, path="/api/v1/auth")


@router.post("/login", response_model=dict)
async def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await authenticate_user(db, body.email, body.password)
    if not user:
        raise UnauthorizedError("Email o contraseña incorrectos.")

    access_token, raw_refresh = await issue_tokens(db, user)
    _set_refresh_cookie(response, raw_refresh)

    return {
        "success": True,
        "data": LoginResponse(
            access_token=access_token,
            user=UserOut.model_validate(user),
        ).model_dump(),
    }


@router.post("/refresh", response_model=dict)
async def refresh(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    raw_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not raw_token:
        raise UnauthorizedError("Refresh token no encontrado.")

    result = await rotate_refresh_token(db, raw_token)
    if not result:
        _clear_refresh_cookie(response)
        raise UnauthorizedError("Refresh token inválido o expirado.")

    access_token, new_raw_refresh, _ = result
    _set_refresh_cookie(response, new_raw_refresh)

    return {
        "success": True,
        "data": RefreshResponse(access_token=access_token).model_dump(),
    }


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    raw_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_token:
        await revoke_refresh_token(db, raw_token)
    _clear_refresh_cookie(response)
    return {"success": True, "data": {"message": "Sesión cerrada correctamente."}}


@router.get("/me", response_model=dict)
async def me(user: CurrentUser):
    return {
        "success": True,
        "data": UserOut.model_validate(user).model_dump(),
    }


@router.post("/change-password")
async def change_password_endpoint(
    body: ChangePasswordRequest,
    response: Response,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    success = await change_password(db, user, body.current_password, body.new_password)
    if not success:
        raise ValidationError("La contraseña actual es incorrecta.")

    _clear_refresh_cookie(response)
    return {
        "success": True,
        "data": {"message": "Contraseña actualizada. Por favor inicia sesión nuevamente."},
    }
