"""add google_event_id to calendar_events

Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision: str = 'u1v2w3x4y5z6'
down_revision: str = 't0u1v2w3x4y5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_events", sa.Column("google_event_id", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("calendar_events", "google_event_id")
