import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, ForeignKey, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

INCOME_CATEGORIES = ("pago_tratamiento", "otro_ingreso")
EXPENSE_CATEGORIES = ("laboratorio", "insumos", "renta", "servicios", "salario", "otro_egreso")

INCOME_CATEGORY_LABELS = {
    "pago_tratamiento": "Pago de tratamiento",
    "otro_ingreso": "Otro ingreso",
}
EXPENSE_CATEGORY_LABELS = {
    "laboratorio": "Laboratorio dental",
    "insumos": "Insumos y materiales",
    "renta": "Renta",
    "servicios": "Servicios (agua/luz/internet)",
    "salario": "Salario / Honorarios",
    "otro_egreso": "Otro egreso",
}


class FinanceTransaction(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "finance_transactions"

    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)          # ingreso | egreso
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount_cordobas: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    original_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    original_currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    exchange_rate_used: Mapped[Decimal | None] = mapped_column(Numeric(10, 4), nullable=True)
    patient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True)
    procedure_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("procedure_catalog.id"), nullable=True)
    operational_cost_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", foreign_keys=[patient_id])  # type: ignore  # noqa: F821
    procedure: Mapped["ProcedureCatalog"] = relationship("ProcedureCatalog", foreign_keys=[procedure_id])  # type: ignore  # noqa: F821
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])  # type: ignore  # noqa: F821
