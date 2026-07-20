"""
Servicio de Configuración de Clínica y Gestión de Usuarios.
"""
import uuid
import secrets
import string
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.clinic import Clinic, ClinicSettings, WorkingHours, ClinicHoliday
from app.models.user import User, ROLES
from app.core.exceptions import NotFoundError, ValidationError, ConflictError
from app.core.security import hash_password


# ─── Configuración de la Clínica ──────────────────────────────────────────────

async def get_clinic_config(db: AsyncSession, clinic_id: uuid.UUID) -> dict:
    """Devuelve settings, horarios y próximos festivos."""
    settings_result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
    )
    settings = settings_result.scalar_one_or_none()
    if not settings:
        raise NotFoundError("Configuración de clínica")

    hours_result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.clinic_id == clinic_id)
        .order_by(WorkingHours.day_of_week)
    )
    working_hours = list(hours_result.scalars().all())

    holidays_result = await db.execute(
        select(ClinicHoliday)
        .where(
            ClinicHoliday.clinic_id == clinic_id,
            ClinicHoliday.date >= func.current_date(),
        )
        .order_by(ClinicHoliday.date)
    )
    holidays = list(holidays_result.scalars().all())

    return {"settings": settings, "working_hours": working_hours, "holidays": holidays}


async def update_clinic_settings(
    db: AsyncSession, clinic_id: uuid.UUID, data: dict
) -> ClinicSettings:
    result = await db.execute(
        select(ClinicSettings).where(ClinicSettings.clinic_id == clinic_id)
    )
    settings = result.scalar_one_or_none()
    if not settings:
        raise NotFoundError("Configuración de clínica")

    for k, v in data.items():
        setattr(settings, k, v)

    await db.flush()
    return settings


async def bulk_update_working_hours(
    db: AsyncSession, clinic_id: uuid.UUID, entries: list[dict]
) -> list[WorkingHours]:
    """Reemplaza los 7 registros de horario de la clínica."""
    result = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.clinic_id == clinic_id)
        .order_by(WorkingHours.day_of_week)
    )
    existing = {wh.day_of_week: wh for wh in result.scalars().all()}

    for entry in entries:
        day = entry["day_of_week"]
        if day in existing:
            wh = existing[day]
            for k, v in entry.items():
                setattr(wh, k, v)
        else:
            db.add(WorkingHours(clinic_id=clinic_id, **entry))

    await db.flush()

    updated = await db.execute(
        select(WorkingHours)
        .where(WorkingHours.clinic_id == clinic_id)
        .order_by(WorkingHours.day_of_week)
    )
    return list(updated.scalars().all())


async def add_holiday(
    db: AsyncSession, clinic_id: uuid.UUID, holiday_date: date, description: str | None
) -> ClinicHoliday:
    exists = await db.scalar(
        select(func.count(ClinicHoliday.clinic_id)).where(
            ClinicHoliday.clinic_id == clinic_id,
            ClinicHoliday.date == holiday_date,
        )
    )
    if exists:
        raise ConflictError(f"Ya existe un festivo registrado para {holiday_date}.")

    holiday = ClinicHoliday(
        clinic_id=clinic_id,
        date=holiday_date,
        description=description,
    )
    db.add(holiday)
    await db.flush()
    return holiday


async def delete_holiday(
    db: AsyncSession, clinic_id: uuid.UUID, holiday_id: uuid.UUID
) -> None:
    result = await db.execute(
        select(ClinicHoliday).where(
            ClinicHoliday.id == holiday_id,
            ClinicHoliday.clinic_id == clinic_id,
        )
    )
    holiday = result.scalar_one_or_none()
    if not holiday:
        raise NotFoundError("Festivo")
    await db.delete(holiday)


# ─── Gestión de Usuarios ──────────────────────────────────────────────────────

def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def _get_user(db: AsyncSession, clinic_id: uuid.UUID, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).where(User.id == user_id, User.clinic_id == clinic_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("Usuario")
    return user


async def list_users(db: AsyncSession, clinic_id: uuid.UUID) -> list[User]:
    result = await db.execute(
        select(User)
        .where(User.clinic_id == clinic_id)
        .order_by(User.full_name)
    )
    return list(result.scalars().all())


async def get_user(db: AsyncSession, clinic_id: uuid.UUID, user_id: uuid.UUID) -> User:
    return await _get_user(db, clinic_id, user_id)


async def create_user(
    db: AsyncSession, clinic_id: uuid.UUID, data: dict
) -> tuple[User, str]:
    """Crea usuario con contraseña temporal. Retorna (user, temp_password)."""
    email = data["email"]
    exists = await db.scalar(
        select(func.count(User.id)).where(User.email == email)
    )
    if exists:
        raise ConflictError(f"El correo '{email}' ya está registrado.")

    if data.get("role") not in ROLES:
        raise ValidationError(f"Rol inválido: {data.get('role')}.")

    temp_password = _generate_temp_password()
    user = User(
        clinic_id=clinic_id,
        email=email,
        full_name=data["full_name"],
        role=data["role"],
        phone=data.get("phone"),
        password_hash=hash_password(temp_password),
        must_change_password=True,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    created = await _get_user(db, clinic_id, user.id)
    return created, temp_password


async def update_user(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    target_user_id: uuid.UUID,
    actor_role: str,
    data: dict,
) -> User:
    user = await _get_user(db, clinic_id, target_user_id)

    # Solo clinic_owner puede modificar otro clinic_owner o promover a ese rol
    new_role = data.get("role")
    if (user.role == "clinic_owner" or new_role == "clinic_owner") and actor_role != "clinic_owner":
        raise ValidationError("Solo el propietario puede modificar o asignar el rol 'clinic_owner'.")

    # Proteger la desactivación del único clinic_owner activo
    new_active = data.get("is_active")
    if new_active is False and user.role == "clinic_owner":
        active_owners = await db.scalar(
            select(func.count(User.id)).where(
                User.clinic_id == clinic_id,
                User.role == "clinic_owner",
                User.is_active == True,  # noqa: E712
            )
        )
        if (active_owners or 0) <= 1:
            raise ValidationError("No se puede desactivar al único propietario activo de la clínica.")

    for k, v in data.items():
        setattr(user, k, v)

    await db.flush()
    return await _get_user(db, clinic_id, target_user_id)


async def reset_user_password(
    db: AsyncSession, clinic_id: uuid.UUID, target_user_id: uuid.UUID
) -> tuple[User, str]:
    """Genera contraseña temporal. En v0.1 se retorna en la respuesta (sin email)."""
    user = await _get_user(db, clinic_id, target_user_id)
    temp_password = _generate_temp_password()
    user.password_hash = hash_password(temp_password)
    user.must_change_password = True
    await db.flush()
    return user, temp_password
