"""configuración del reparto sugerido

Revision ID: zp01distributioncfg2026
Revises: zo01doctoraccount2026
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "zp01distributioncfg2026"
down_revision = "zo01doctoraccount2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "finance_distribution_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("reposicion_pct", sa.Numeric(5, 2), nullable=False, server_default="25"),
        sa.Column("mejoras_pct", sa.Numeric(5, 2), nullable=False, server_default="10"),
    )


def downgrade() -> None:
    op.drop_table("finance_distribution_config")
