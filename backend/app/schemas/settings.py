from datetime import date, time
from typing import Literal
from pydantic import BaseModel, field_validator, EmailStr


class ClinicSettingsUpdate(BaseModel):
    display_name: str | None = None
    legal_name: str | None = None
    tax_id: str | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    country: str | None = None
    default_appointment_duration_minutes: int | None = None
    appointment_slot_size_minutes: int | None = None
    currency_code: str | None = None
    currency_symbol: str | None = None


class WorkingHoursEntry(BaseModel):
    day_of_week: int  # 0=Domingo … 6=Sábado
    is_working_day: bool
    morning_open: time | None = None
    morning_close: time | None = None
    afternoon_open: time | None = None
    afternoon_close: time | None = None

    @field_validator("day_of_week")
    @classmethod
    def valid_day(cls, v: int) -> int:
        if v not in range(7):
            raise ValueError("day_of_week debe estar entre 0 (Dom) y 6 (Sáb).")
        return v


class WorkingHoursBulkUpdate(BaseModel):
    hours: list[WorkingHoursEntry]

    @field_validator("hours")
    @classmethod
    def all_7_days(cls, v: list) -> list:
        days = {entry.day_of_week for entry in v}
        if days != set(range(7)):
            raise ValueError("Deben incluirse los 7 días de la semana (0–6).")
        return v


class HolidayCreate(BaseModel):
    date: date
    description: str | None = None


# ─── Usuarios ─────────────────────────────────────────────────────────────────

UserRole = Literal["admin", "dentist", "receptionist", "assistant"]
AnyRole = Literal["clinic_owner", "admin", "dentist", "receptionist", "assistant"]


class UserCreate(BaseModel):
    email: str
    full_name: str
    role: UserRole
    phone: str | None = None

    @field_validator("full_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str) -> str:
        return v.strip().lower()


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: AnyRole | None = None
    phone: str | None = None
    is_active: bool | None = None
