import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

TREATMENT_PLAN_STATUSES = ("active", "completed", "abandoned", "on_hold")
TREATMENT_ITEM_STATUSES = ("pending", "in_progress", "completed", "cancelled")
TREATMENT_PRIORITIES = ("normal", "urgent")


class ProcedureCatalog(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "procedure_catalog"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    default_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    default_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    category: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # is_system=True indica que es un procedimiento sembrado por el sistema (no eliminable)

    items: Mapped[list["TreatmentPlanItem"]] = relationship(back_populates="procedure")


class TreatmentPlan(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "treatment_plans"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False
    )
    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    diagnosis: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    abandoned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    abandoned_reason: Mapped[str | None] = mapped_column(Text)

    # Relaciones
    patient: Mapped["Patient"] = relationship(back_populates="treatment_plans")
    created_by: Mapped["User"] = relationship(foreign_keys=[created_by_id])
    items: Mapped[list["TreatmentPlanItem"]] = relationship(
        back_populates="treatment_plan", order_by="TreatmentPlanItem.sort_order"
    )


class TreatmentPlanItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "treatment_plan_items"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    treatment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("treatment_plans.id"), nullable=False
    )
    procedure_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("procedure_catalog.id"), nullable=False
    )
    # Cita en la que se completó el ítem (solo cuando status='completed')
    completed_in_appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id")
    )

    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    priority: Mapped[str] = mapped_column(String(10), default="normal", nullable=False)

    tooth_fdi: Mapped[str | None] = mapped_column(String(10))  # Notación FDI: "11", "36", etc.
    notes: Mapped[str | None] = mapped_column(Text)
    quoted_price: Mapped[float | None] = mapped_column(Numeric(10, 2))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relaciones
    treatment_plan: Mapped["TreatmentPlan"] = relationship(back_populates="items")
    procedure: Mapped["ProcedureCatalog"] = relationship(back_populates="items")
