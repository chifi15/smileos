import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Text, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin

REWARDS_LEVELS = ("starter", "bronze", "silver", "gold", "diamond")

TRANSACTION_TYPES = (
    "visit",
    "on_time",
    "cleaning",
    "treatment_completed",
    "referral_completed",
    "review",
    "consecutive_semesters",
    "welcome",
    "birthday_visit",
    "redemption",
    "adjustment",
)

# Puntos por tipo de transacción (fuente de verdad)
POINTS_TABLE = {
    "visit": 20,
    "on_time": 10,
    "cleaning": 30,
    "treatment_completed": 100,
    "referral_completed": 200,
    "review": 50,
    "consecutive_semesters": 75,
    "welcome": 50,
    "birthday_visit": 25,
}

# Puntos mínimos para cada nivel
LEVEL_THRESHOLDS = {
    "starter": 0,
    "bronze": 200,
    "silver": 500,
    "gold": 1000,
    "diamond": 2000,
}


class RewardsAccount(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "rewards_accounts"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), unique=True, nullable=False
    )

    total_points: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    level: Mapped[str] = mapped_column(String(10), default="starter", nullable=False)
    level_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Control de inactividad
    last_visit_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    benefits_suspended: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # benefits_suspended=True cuando no hay visita en los últimos 12 meses

    # Control de referidos (evitar duplicados)
    referral_credits_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="rewards_account")
    transactions: Mapped[list["RewardsTransaction"]] = relationship(back_populates="account")


class RewardsTransaction(UUIDMixin, Base):
    __tablename__ = "rewards_transactions"
    __table_args__ = (
        # Idempotencia: cada evento solo genera una transacción por tipo
        UniqueConstraint("appointment_id", "transaction_type", name="uq_appointment_transaction_type"),
    )

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("rewards_accounts.id"), nullable=False
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id")
    )

    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)  # negativo para redenciones
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default="now()", nullable=False
    )

    account: Mapped["RewardsAccount"] = relationship(back_populates="transactions")
