import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class ClinicalRecord(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "clinical_records"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id"), unique=True, nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    written_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Exploración
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    treatment_performed: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)

    # Odontograma como JSON: {tooth_id: {status, notes}}
    odontogram_snapshot: Mapped[dict | None] = mapped_column(JSONB)

    # Signos vitales opcionales
    blood_pressure: Mapped[str | None] = mapped_column(String(20))
    heart_rate: Mapped[int | None]

    # Ventana de edición de 24h
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Addenda (correcciones después del periodo de edición)
    addenda: Mapped[list | None] = mapped_column(JSONB, default=list)
    # Formato: [{"text": "...", "added_by": "user_id", "added_at": "ISO datetime"}]

    # Relaciones
    appointment: Mapped["Appointment"] = relationship(back_populates="clinical_record")
    written_by: Mapped["User"] = relationship(foreign_keys=[written_by_id])
