import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

TOOTH_CONDITIONS = (
    "sano",
    "caries",
    "obturado",
    "endodoncia",
    "corona",
    "extraccion_indicada",
    "extraido",
    "implante",
    "fractura",
    "necrosis_pulpar",
    "desgaste",
)

# Piezas adultas FDI: 11-18, 21-28, 31-38, 41-48
ADULT_TEETH = (
    [18, 17, 16, 15, 14, 13, 12, 11]  # cuadrante 1
    + [21, 22, 23, 24, 25, 26, 27, 28]  # cuadrante 2
    + [31, 32, 33, 34, 35, 36, 37, 38]  # cuadrante 3
    + [41, 42, 43, 44, 45, 46, 47, 48]  # cuadrante 4
)


ODONTOGRAM_KINDS = ("inicial", "tratamiento")


class OdontogramTooth(UUIDMixin, Base):
    """Estado de cada pieza dental de un paciente para un kind dado."""
    __tablename__ = "odontogram_teeth"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="inicial")
    tooth_number: Mapped[int] = mapped_column(Integer, nullable=False)
    condition: Mapped[str] = mapped_column(String(30), nullable=False, default="sano")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    updated_by: Mapped["User"] = relationship("User", foreign_keys=[updated_by_id])  # type: ignore  # noqa: F821


class TreatmentQuote(UUIDMixin, Base):
    """Cotización activa del plan de tratamiento por paciente (una por paciente)."""
    __tablename__ = "treatment_quotes"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    items: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class OdontogramSnapshot(UUIDMixin, Base):
    """Historial: cada guardado crea un snapshot del odontograma completo."""
    __tablename__ = "odontogram_snapshots"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="inicial")
    # JSON: {"11": {"condition": "sano", "notes": null}, ...}
    teeth_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    snapshot_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])  # type: ignore  # noqa: F821
