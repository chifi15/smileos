import uuid
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, field_validator


class LevelProgress(BaseModel):
    current_level: str
    current_points: int
    next_level: str | None
    next_level_threshold: int | None
    points_to_next_level: int
    progress_percent: float


class RewardsAccountDetail(BaseModel):
    id: str
    patient_id: str
    level: str
    total_points: int
    benefits_suspended: bool
    last_visit_date: str | None
    level_updated_at: str | None
    progress: LevelProgress


class RewardsTransactionOut(BaseModel):
    id: str
    transaction_type: str
    points: int
    balance_after: int
    description: str | None
    appointment_id: str | None
    created_at: str


BonusType = Literal["review", "birthday_visit", "consecutive_semesters"]


class GrantBonusRequest(BaseModel):
    bonus_type: BonusType
    appointment_id: uuid.UUID | None = None


class ManualAdjustRequest(BaseModel):
    points: int
    description: str

    @field_validator("points")
    @classmethod
    def not_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("El ajuste no puede ser 0 puntos.")
        return v

    @field_validator("description")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("La descripción es obligatoria.")
        return v
