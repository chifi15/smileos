"""add google_event_id to appointments

Revision ID: x4y5z6a7b8c9
Revises: w3x4y5z6a7b8
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision = "x4y5z6a7b8c9"
down_revision = "w3x4y5z6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "appointments",
        sa.Column("google_event_id", sa.String(100), nullable=True),
    )


def downgrade():
    op.drop_column("appointments", "google_event_id")
