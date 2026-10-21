"""add deleted_at for soft deletes on appointments, finance_transactions, treatment_plans

Revision ID: sd01softdelete2026
Revises: pl01plans2026
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = "sd01softdelete2026"
down_revision = "pl01plans2026"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("appointments", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("finance_transactions", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("treatment_plans", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_index("ix_appointments_deleted_at", "appointments", ["deleted_at"])
    op.create_index("ix_finance_transactions_deleted_at", "finance_transactions", ["deleted_at"])
    op.create_index("ix_treatment_plans_deleted_at", "treatment_plans", ["deleted_at"])


def downgrade():
    op.drop_index("ix_appointments_deleted_at", "appointments")
    op.drop_index("ix_finance_transactions_deleted_at", "finance_transactions")
    op.drop_index("ix_treatment_plans_deleted_at", "treatment_plans")

    op.drop_column("appointments", "deleted_at")
    op.drop_column("finance_transactions", "deleted_at")
    op.drop_column("treatment_plans", "deleted_at")
