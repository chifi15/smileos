import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

PHOTO_TYPES = (
    "profile",
    "intraoral_frontal",
    "intraoral_lateral_right",
    "intraoral_lateral_left",
    "extraoral_frontal",
    "extraoral_profile",
    "xray",
    "other",
)

ALLOWED_MIME_TYPES = ("image/jpeg", "image/png", "image/webp")
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class PatientPhoto(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "patient_photos"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id")
    )
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    photo_type: Mapped[str] = mapped_column(String(30), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)

    caption: Mapped[str | None] = mapped_column(Text)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relaciones
    patient: Mapped["Patient"] = relationship(back_populates="photos")
    appointment: Mapped["Appointment | None"] = relationship(back_populates="photos")
    uploaded_by: Mapped["User"] = relationship(foreign_keys=[uploaded_by_id])
