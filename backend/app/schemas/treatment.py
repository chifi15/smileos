import uuid
from typing import Literal
from pydantic import BaseModel, field_validator


# ─── Catálogo ─────────────────────────────────────────────────────────────────

class ProcedureCreate(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    default_duration_minutes: int = 30
    default_price: float | None = None
    category: str | None = None

    @field_validator("name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío.")
        return v


class ProcedureUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    description: str | None = None
    default_duration_minutes: int | None = None
    default_price: float | None = None
    operational_cost: float | None = None
    category: str | None = None


# ─── Plan de Tratamiento ──────────────────────────────────────────────────────

class TreatmentPlanCreate(BaseModel):
    title: str
    diagnosis: str | None = None
    notes: str | None = None

    @field_validator("title")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El título no puede estar vacío.")
        return v


class TreatmentPlanUpdate(BaseModel):
    title: str | None = None
    diagnosis: str | None = None
    notes: str | None = None
    status: Literal["active", "on_hold", "abandoned"] | None = None
    abandoned_reason: str | None = None


# ─── Ítems del Plan ───────────────────────────────────────────────────────────

class TreatmentItemCreate(BaseModel):
    procedure_id: uuid.UUID
    tooth_fdi: str | None = None
    priority: Literal["normal", "urgent"] = "normal"
    notes: str | None = None
    quoted_price: float | None = None
    sort_order: int = 0


class TreatmentItemUpdate(BaseModel):
    tooth_fdi: str | None = None
    priority: Literal["normal", "urgent"] | None = None
    notes: str | None = None
    quoted_price: float | None = None
    sort_order: int | None = None


class CompleteItemRequest(BaseModel):
    appointment_id: uuid.UUID | None = None
