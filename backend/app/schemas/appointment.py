import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, field_validator

AppointmentType = Literal[
    "primera_consulta", "control", "limpieza", "extraccion",
    "endodoncia", "ortodoncia", "protesis", "cirugia", "emergencia", "otro",
]
AppointmentStatus = Literal[
    "scheduled", "confirmed", "in_progress", "completed", "cancelled", "no_show",
]


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    dentist_id: uuid.UUID
    scheduled_at: datetime
    duration_minutes: int = 30
    appointment_type: AppointmentType
    reason: str | None = None
    notes: str | None = None

    @field_validator("duration_minutes")
    @classmethod
    def validate_duration(cls, v: int) -> int:
        if v < 15 or v > 480:
            raise ValueError("La duración debe estar entre 15 y 480 minutos.")
        return v


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    appointment_type: AppointmentType | None = None
    dentist_id: uuid.UUID | None = None
    reason: str | None = None
    notes: str | None = None


class CancelRequest(BaseModel):
    cancellation_reason: str | None = None


class AppointmentOut(BaseModel):
    id: str
    clinic_id: str
    patient_id: str
    patient_name: str
    patient_rewards_level: str | None
    dentist_id: str
    dentist_name: str
    scheduled_at: str
    end_at: str
    duration_minutes: int
    appointment_type: str
    status: str
    reason: str | None
    notes: str | None
    confirmed_at: str | None
    started_at: str | None
    completed_at: str | None
    cancelled_at: str | None
    cancellation_reason: str | None
    created_at: str
