import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

# Estados válidos de una cita
APPOINTMENT_STATUSES = (
    "scheduled",    # creada
    "confirmed",    # confirmada por el paciente
    "in_progress",  # en curso (dentista inició)
    "completed",    # finalizada
    "cancelled",    # cancelada
    "no_show",      # paciente no llegó
)

APPOINTMENT_TYPES = (
    "primera_consulta",
    "control",
    "limpieza",
    "extraccion",
    "endodoncia",
    "ortodoncia",
    "protesis",
    "cirugia",
    "emergencia",
    "otro",
)


class Appointment(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "appointments"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    dentist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    appointment_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="scheduled", nullable=False)

    reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    # Timestamps de transiciones de estado
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)

    # Relaciones
    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    dentist: Mapped["User"] = relationship(foreign_keys=[dentist_id])
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    clinical_record: Mapped["ClinicalRecord | None"] = relationship(back_populates="appointment", uselist=False)
    photos: Mapped[list["PatientPhoto"]] = relationship(back_populates="appointment")
