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
    ChangePasswordRequest, UserOut, RegisterRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services.auth_service import (
    authenticate_user, issue_tokens, rotate_refresh_token,
    revoke_refresh_token, change_password, register_clinic,
    create_reset_token, reset_password_with_token,
    find_or_create_google_user, REFRESH_TOKEN_COOKIE,
)
from app.services.email_service import send_password_reset_email
from app.services import google_oauth_service as google_oauth
from fastapi.responses import RedirectResponse
from app.core.rate_limit import limiter

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


@router.post("/register", response_model=dict, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    user = await register_clinic(
        db,
        clinic_name=body.clinic_name,
        full_name=body.full_name,
        email=body.email,
        password=body.password,
    )
    await db.commit()
    await db.refresh(user)

    access_token, raw_refresh = await issue_tokens(db, user)
    await db.commit()
    _set_refresh_cookie(response, raw_refresh)

    return {
        "success": True,
        "data": LoginResponse(
            access_token=access_token,
            user=UserOut.model_validate(user),
        ).model_dump(),
    }


@router.post("/login", response_model=dict)
@limiter.limit("10/minute")
async def login(
    request: Request,
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
async def me(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from sqlalchemy import select as _select
    from app.models.clinic import Clinic
    clinic = await db.scalar(_select(Clinic).where(Clinic.id == user.clinic_id))
    data = UserOut.model_validate(user).model_dump()
    data["clinic_slug"] = clinic.slug if clinic else ""
    return {"success": True, "data": data}


@router.get("/google/authorize")
async def google_authorize():
    if not settings.google_client_id:
        from app.core.exceptions import ValidationError
        raise ValidationError("Google OAuth no configurado.")
    url = google_oauth.build_login_auth_url()
    return {"success": True, "data": {"url": url}}


@router.get("/google/callback")
async def google_callback(
    code: str,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    frontend_url = settings.frontend_url
    try:
        tokens = await google_oauth.exchange_login_code(code)
        user_info = await google_oauth.get_google_user_info(tokens["access_token"])
        email = user_info.get("email")
        name = user_info.get("name", email)
        if not email:
            return RedirectResponse(f"{frontend_url}/login?error=google")

        user = await find_or_create_google_user(db, email, name)
        await db.commit()
        await db.refresh(user)

        access_token, raw_refresh = await issue_tokens(db, user)
        await db.commit()

        redirect = RedirectResponse(f"{frontend_url}/auth/google/callback?access_token={access_token}")
        redirect.set_cookie(
            key=REFRESH_TOKEN_COOKIE,
            value=raw_refresh,
            httponly=True,
            secure=settings.is_production,
            samesite="lax",
            max_age=_COOKIE_MAX_AGE,
            path="/api/v1/auth",
        )
        return redirect
    except Exception as e:
        return RedirectResponse(f"{frontend_url}/login?error=google")


@router.post("/forgot-password")
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await create_reset_token(db, body.email)
    if result:
        raw_token, user = result
        reset_url = f"{settings.frontend_url}/reset-password?token={raw_token}"
        send_password_reset_email(user.email, user.full_name, reset_url)
        await db.commit()
    # Siempre responder igual para no revelar si el email existe
    return {"success": True, "data": {"message": "Si el correo existe, recibirás un enlace en breve."}}


@router.post("/reset-password")
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    success = await reset_password_with_token(db, body.token, body.new_password)
    if not success:
        from app.core.exceptions import ValidationError
        raise ValidationError("El enlace es inválido o ya expiró.")
    await db.commit()
    return {"success": True, "data": {"message": "Contraseña actualizada. Ya puedes iniciar sesión."}}


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
