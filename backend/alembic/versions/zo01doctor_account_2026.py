"""cuenta del doctor: doctor_commissions y expense_categories.is_doctor_payment

Revision ID: zo01doctoraccount2026
Revises: zn01expensefixedlink2026
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "zo01doctoraccount2026"
down_revision = "zn01expensefixedlink2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "expense_categories",
        sa.Column("is_doctor_payment", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "doctor_commissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pct", sa.Numeric(5, 2), nullable=False),
        sa.UniqueConstraint("clinic_id", "doctor_id", name="uq_doctor_commission"),
    )


def downgrade() -> None:
    op.drop_table("doctor_commissions")
    op.drop_column("expense_categories", "is_doctor_payment")
