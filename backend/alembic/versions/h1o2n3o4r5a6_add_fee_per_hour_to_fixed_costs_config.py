"""add fee_per_hour to fixed_costs_config

Revision ID: h1o2n3o4r5a6
Revises: z6a7b8c9d0e1
Create Date: 2026-09-02

"""
from alembic import op
import sqlalchemy as sa

revision = "h1o2n3o4r5a6"
down_revision = "ui01pref2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fixed_costs_config",
        sa.Column("fee_per_hour", sa.Float(), nullable=False, server_default="192.0"),
    )


def downgrade() -> None:
    op.drop_column("fixed_costs_config", "fee_per_hour")
