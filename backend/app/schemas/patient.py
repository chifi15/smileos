import uuid
from datetime import date, datetime
from typing import Literal, Any
from pydantic import BaseModel, EmailStr, field_validator, computed_field


class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date | None = None
    gender: Literal["M", "F", "other"] | None = None
    id_number: str | None = None

    phone: str | None = None
    phone_secondary: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None

    blood_type: str | None = None
    allergies: str | None = None
    medical_conditions: str | None = None
    current_medications: str | None = None

    chief_complaint: str | None = None
    referred_by_patient_id: uuid.UUID | None = None
    notes: str | None = None

    @field_validator("first_name", "last_name")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El campo no puede estar vacío.")
        return v


class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    gender: Literal["M", "F", "other"] | None = None
    id_number: str | None = None

    phone: str | None = None
    phone_secondary: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None

    blood_type: str | None = None
    allergies: str | None = None
    medical_conditions: str | None = None
    current_medications: str | None = None

    chief_complaint: str | None = None
    notes: str | None = None


class RewardsSummary(BaseModel):
    level: str
    total_points: int
    benefits_suspended: bool

    model_config = {"from_attributes": True}


class PatientOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    first_name: str
    last_name: str
    full_name: str
    date_of_birth: date | None
    gender: str | None
    id_number: str | None
    phone: str | None
    phone_secondary: str | None
    email: str | None
    address: str | None
    city: str | None
    country: str | None
    emergency_contact_name: str | None
    emergency_contact_phone: str | None
    blood_type: str | None
    allergies: str | None
    medical_conditions: str | None
    current_medications: str | None
    chief_complaint: str | None
    referred_by_patient_id: uuid.UUID | None
    is_active: bool
    patient_number: int | None
    first_visit_date: date | None
    notes: str | None
    rewards: RewardsSummary | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientListItem(BaseModel):
    id: uuid.UUID
    full_name: str
    date_of_birth: date | None
    phone: str | None
    email: str | None
    is_active: bool
    patient_number: int | None
    rewards_level: str | None
    rewards_points: int | None
    first_visit_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
