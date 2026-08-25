"""add google oauth tokens to clinic_settings

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision: str = 't0u1v2w3x4y5'
down_revision: str = 's9t0u1v2w3x4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clinic_settings", sa.Column("google_refresh_token", sa.Text(), nullable=True))
    op.add_column("clinic_settings", sa.Column("google_calendar_id", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("clinic_settings", "google_calendar_id")
    op.drop_column("clinic_settings", "google_refresh_token")
