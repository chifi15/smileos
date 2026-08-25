"""add gcal_color to calendar_events

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op

revision: str = 's9t0u1v2w3x4'
down_revision: str = 'r8s9t0u1v2w3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("calendar_events", sa.Column("gcal_color", sa.String(30), nullable=True))


def downgrade() -> None:
    op.drop_column("calendar_events", "gcal_color")
