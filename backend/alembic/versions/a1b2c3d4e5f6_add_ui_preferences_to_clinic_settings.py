"""add ui_preferences to clinic_settings

Revision ID: a1b2c3d4e5f6
Revises: z6a7b8c9d0e1
Create Date: 2026-09-01
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a1b2c3d4e5f6"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "clinic_settings",
        sa.Column("ui_preferences", JSONB, nullable=True),
    )


def downgrade():
    op.drop_column("clinic_settings", "ui_preferences")
