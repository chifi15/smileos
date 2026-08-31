"""add deducted_materials to finance_transactions

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-08-31
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "z6a7b8c9d0e1"
down_revision = "y5z6a7b8c9d0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "finance_transactions",
        sa.Column("deducted_materials", JSONB, nullable=True),
    )


def downgrade():
    op.drop_column("finance_transactions", "deducted_materials")
