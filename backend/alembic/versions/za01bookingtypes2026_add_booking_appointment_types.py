"""add booking_appointment_types to clinic_settings

Revision ID: za01bookingtypes2026
Revises: z6a7b8c9d0e1
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "za01bookingtypes2026"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clinic_settings",
        sa.Column("booking_appointment_types", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("clinic_settings", "booking_appointment_types")
