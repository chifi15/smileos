"""add doctor_id to finance_transactions

Revision ID: q7r8s9t0u1v2
Revises: p6q7r8s9t0u1
Create Date: 2026-08-19
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'q7r8s9t0u1v2'
down_revision: str = 'p6q7r8s9t0u1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_transactions",
        sa.Column("doctor_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_finance_transactions_doctor_id", "finance_transactions", ["doctor_id"])


def downgrade() -> None:
    op.drop_index("ix_finance_transactions_doctor_id", table_name="finance_transactions")
    op.drop_column("finance_transactions", "doctor_id")
