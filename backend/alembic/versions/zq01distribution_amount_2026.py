"""reparto: fondo de mejoras como monto fijo, reposición con costos reales

Revision ID: zq01distributionamount2026
Revises: zp01distributioncfg2026
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa

revision = "zq01distributionamount2026"
down_revision = "zp01distributioncfg2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("finance_distribution_config", sa.Column("mejoras_monto", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.drop_column("finance_distribution_config", "reposicion_pct")
    op.drop_column("finance_distribution_config", "mejoras_pct")


def downgrade() -> None:
    op.add_column("finance_distribution_config", sa.Column("reposicion_pct", sa.Numeric(5, 2), nullable=False, server_default="25"))
    op.add_column("finance_distribution_config", sa.Column("mejoras_pct", sa.Numeric(5, 2), nullable=False, server_default="10"))
    op.drop_column("finance_distribution_config", "mejoras_monto")
