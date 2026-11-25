import uuid
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Text, ForeignKey, Numeric, Date, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
    cost_treatment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("cost_treatments.id", ondelete="SET NULL"), nullable=True)
    procedure_quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    # True: honorarios y costos fijos se multiplican por la cantidad (x2). False: se cobran una sola vez (x1).
    scale_fees_by_quantity: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true", default=True)
    operational_cost_snapshot: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    cost_appointment_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    deducted_materials: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    extra_procedures: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    receipt_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", foreign_keys=[patient_id])  # type: ignore  # noqa: F821
    procedure: Mapped["ProcedureCatalog"] = relationship("ProcedureCatalog", foreign_keys=[procedure_id])  # type: ignore  # noqa: F821
    cost_treatment: Mapped["CostTreatment"] = relationship("CostTreatment", foreign_keys=[cost_treatment_id])  # type: ignore  # noqa: F821
    doctor: Mapped["User"] = relationship("User", foreign_keys=[doctor_id])  # type: ignore  # noqa: F821

    @property
    def procedure_display_name(self) -> str | None:
        """Nombre del procedimiento: tratamiento de Costos Operativos (o catálogo legado)."""
        if self.cost_treatment:
            return self.cost_treatment.name
        return self.procedure.name if self.procedure else None

    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])  # type: ignore  # noqa: F821


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # True: el gasto ya está incluido en costos operativos (honorarios, costos fijos o materiales).
    # Se registra igual, pero no se resta de la utilidad para no contarlo dos veces.
    covered_by_op_costs: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)
    # Id del costo fijo (Costos → Costos Fijos) que esta categoría representa, para comparar presupuesto vs real.
    fixed_cost_item_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # True: los egresos de esta categoría con un doctor marcado cuentan como pago por tratamientos a ese doctor.
    is_doctor_payment: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false", default=False)


class DoctorCommission(Base):
    """Porcentaje de lo cobrado en sus tratamientos que le corresponde a un doctor."""
    __tablename__ = "doctor_commissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
