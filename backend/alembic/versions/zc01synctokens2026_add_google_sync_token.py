"""add google_sync_token to clinic_settings

Revision ID: zc01synctokens2026
Revises: zb01guestphone2026
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = "zc01synctokens2026"
down_revision = "zb01guestphone2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clinic_settings",
        sa.Column("google_sync_token", sa.Text, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clinic_settings", "google_sync_token")
