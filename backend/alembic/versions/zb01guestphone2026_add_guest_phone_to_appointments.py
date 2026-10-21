"""add guest_phone to appointments

Revision ID: zb01guestphone2026
Revises: za01bookingtypes2026
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = "zb01guestphone2026"
down_revision = "za01bookingtypes2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("guest_phone", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "guest_phone")
