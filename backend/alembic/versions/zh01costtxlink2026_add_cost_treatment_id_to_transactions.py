"""add cost_treatment_id to finance_transactions

Revision ID: zh01costtxlink2026
Revises: zg01resetpatients2026
Create Date: 2026-10-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "zh01costtxlink2026"
down_revision = "zg01resetpatients2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_transactions",
        sa.Column(
            "cost_treatment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("cost_treatments.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("finance_transactions", "cost_treatment_id")
