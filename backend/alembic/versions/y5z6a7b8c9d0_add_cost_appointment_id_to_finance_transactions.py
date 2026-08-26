"""add cost_appointment_id to finance_transactions

Revision ID: y5z6a7b8c9d0
Revises: x4y5z6a7b8c9
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "y5z6a7b8c9d0"
down_revision = "x4y5z6a7b8c9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "finance_transactions",
        sa.Column("cost_appointment_id", sa.String(36), nullable=True),
    )


def downgrade():
    op.drop_column("finance_transactions", "cost_appointment_id")
