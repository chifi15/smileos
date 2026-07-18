import uuid
from datetime import date, datetime
from sqlalchemy import String, Boolean, Date, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Patient(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "patients"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )

    # Datos personales
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(10))  # M | F | other
    id_number: Mapped[str | None] = mapped_column(String(50))  # Cédula

    # Contacto
    phone: Mapped[str | None] = mapped_column(String(20))
    phone_secondary: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(String(500))
    emergency_contact_name: Mapped[str | None] = mapped_column(String(200))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(20))

    # Historia médica
    blood_type: Mapped[str | None] = mapped_column(String(5))
    allergies: Mapped[str | None] = mapped_column(Text)
    medical_conditions: Mapped[str | None] = mapped_column(Text)
    current_medications: Mapped[str | None] = mapped_column(Text)

    # Referido
    referred_by_patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id")
    )

    # Estado
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_visit_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    # Relaciones
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")
    rewards_account: Mapped["RewardsAccount"] = relationship(back_populates="patient", uselist=False)
    treatment_plans: Mapped[list["TreatmentPlan"]] = relationship(back_populates="patient")
    photos: Mapped[list["PatientPhoto"]] = relationship(back_populates="patient")
    referred_by: Mapped["Patient | None"] = relationship(
        foreign_keys=[referred_by_patient_id], remote_side="Patient.id"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
