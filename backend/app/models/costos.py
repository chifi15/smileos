import uuid
from datetime import datetime, date
from typing import Optional, List, Any
import sqlalchemy as sa
from sqlalchemy import String, Float, Integer, ForeignKey, DateTime, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class CostProduct(Base):
    __tablename__ = "cost_products"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="otros")
    unit_price: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    presentation: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    portion_description: Mapped[str] = mapped_column(String(200), nullable=False, default="")

    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    total_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    presentation_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    presentation_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    portion_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    stock_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    min_stock_qty: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    purchase_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CostTreatment(Base):
    __tablename__ = "cost_treatments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    professional_fee_per_hour: Mapped[float] = mapped_column(Float, nullable=False, default=192.0)
    total_hours: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    fixed_costs: Mapped[float] = mapped_column(Float, nullable=False, default=216.0)
    clinic_margin_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    suggested_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    procedure_catalog_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)

    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    appointments: Mapped[List["CostAppointment"]] = relationship(
        "CostAppointment",
        back_populates="treatment",
        cascade="all, delete-orphan",
        order_by="CostAppointment.sort_order",
    )


class CostAppointment(Base):
    __tablename__ = "cost_appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    treatment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_treatments.id", ondelete="CASCADE"), nullable=False, index=True)

    number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    materials: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    treatment: Mapped["CostTreatment"] = relationship("CostTreatment", back_populates="appointments")


class CostProductLot(Base):
    __tablename__ = "cost_product_lots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_products.id", ondelete="CASCADE"), nullable=False, index=True)

    opened_at: Mapped[date] = mapped_column(Date, nullable=False)
    expected_portions: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    used_portions: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    finished_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class FixedCostsConfig(Base):
    __tablename__ = "fixed_costs_config"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, unique=True)
    patients_per_month: Mapped[int] = mapped_column(Integer, nullable=False, default=40)
    items: Mapped[List[Any]] = mapped_column(JSONB, nullable=False, default=list)
    fee_per_hour: Mapped[float] = mapped_column(Float, nullable=False, default=192.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
