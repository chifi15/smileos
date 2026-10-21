"""add plan and plan_expires_at to clinics

Revision ID: pl01plans2026
Revises: pw01reset2026
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = "pl01plans2026"
down_revision = "pw01reset2026"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "clinics",
        sa.Column("plan", sa.String(20), nullable=False, server_default="free"),
    )
    op.add_column(
        "clinics",
        sa.Column("plan_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("clinics", "plan_expires_at")
    op.drop_column("clinics", "plan")
