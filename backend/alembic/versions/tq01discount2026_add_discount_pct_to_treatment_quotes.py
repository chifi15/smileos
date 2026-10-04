"""add discount_pct to treatment_quotes

Revision ID: tq01discount2026
Revises: tp01abonos2026
Create Date: 2026-10-04 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "tq01discount2026"
down_revision = "tp01abonos2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "treatment_quotes",
        sa.Column("discount_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("treatment_quotes", "discount_pct")
