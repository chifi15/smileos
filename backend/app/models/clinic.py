import uuid
from datetime import time
from decimal import Decimal
from sqlalchemy import String, Boolean, Integer, SmallInteger, Time, Date, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base
from app.models.base import UUIDMixin, TimestampMixin


class Clinic(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relaciones
    settings: Mapped["ClinicSettings"] = relationship(back_populates="clinic", uselist=False)
    working_hours: Mapped[list["WorkingHours"]] = relationship(back_populates="clinic")
    holidays: Mapped[list["ClinicHoliday"]] = relationship(back_populates="clinic")


class ClinicSettings(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "clinic_settings"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), unique=True, nullable=False
    )

    # Información básica
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(200))
    tax_id: Mapped[str | None] = mapped_column(String(50))
    logo_storage_path: Mapped[str | None] = mapped_column(String(500))

    # Contacto
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str] = mapped_column(String(2), default="NI", nullable=False)

    # Operaciones
    default_appointment_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    appointment_slot_size_minutes: Mapped[int] = mapped_column(Integer, default=15, nullable=False)

    # Financiero
    currency_code: Mapped[str] = mapped_column(String(3), default="NIO", nullable=False)
    currency_symbol: Mapped[str] = mapped_column(String(5), default="C$", nullable=False)
    usd_exchange_rate: Mapped[Decimal] = mapped_column(Numeric(10, 4), default=Decimal("37.0"), nullable=False, server_default="37.0")

    # v0.2
    whatsapp_reminder_hours_before: Mapped[int | None] = mapped_column(Integer, default=24)

    clinic: Mapped["Clinic"] = relationship(back_populates="settings")


class WorkingHours(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "working_hours"
    __table_args__ = (UniqueConstraint("clinic_id", "day_of_week"),)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Dom...6=Sáb
    is_working_day: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    morning_open: Mapped[time | None] = mapped_column(Time)
    morning_close: Mapped[time | None] = mapped_column(Time)
    afternoon_open: Mapped[time | None] = mapped_column(Time)
    afternoon_close: Mapped[time | None] = mapped_column(Time)

    clinic: Mapped["Clinic"] = relationship(back_populates="working_hours")


class ClinicHoliday(UUIDMixin, Base):
    __tablename__ = "clinic_holidays"
    __table_args__ = (UniqueConstraint("clinic_id", "date"),)

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False
    )
    date: Mapped[Date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(String(200))

    from datetime import datetime
    created_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default="now()"
    )

    clinic: Mapped["Clinic"] = relationship(back_populates="holidays")
