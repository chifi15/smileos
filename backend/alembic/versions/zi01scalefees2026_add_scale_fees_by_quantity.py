"""add scale_fees_by_quantity to finance_transactions

Revision ID: zi01scalefees2026
Revises: zf01costtreatid2026
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa

revision = "zi01scalefees2026"
down_revision = "zf01costtreatid2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Las transacciones existentes conservan el comportamiento actual (x cantidad).
    op.add_column(
        "finance_transactions",
        sa.Column("scale_fees_by_quantity", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("finance_transactions", "scale_fees_by_quantity")
