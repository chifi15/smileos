"""add treatment_payments table

Revision ID: a1b2c3d4e5f6
Revises: 68a33daedeef
Create Date: 2026-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a1b2c3d4e5f6"
down_revision = "68a33daedeef"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "treatment_payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("treatment_plan_id", UUID(as_uuid=True), sa.ForeignKey("treatment_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date", sa.Date, nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_by_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index("ix_treatment_payments_treatment_plan_id", "treatment_payments", ["treatment_plan_id"])
    op.create_index("ix_treatment_payments_clinic_id", "treatment_payments", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("ix_treatment_payments_clinic_id", "treatment_payments")
    op.drop_index("ix_treatment_payments_treatment_plan_id", "treatment_payments")
    op.drop_table("treatment_payments")
