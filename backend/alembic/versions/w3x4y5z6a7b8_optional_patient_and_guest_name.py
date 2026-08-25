"""optional patient_id and guest_name on appointments

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-08-25
"""
from alembic import op
import sqlalchemy as sa

revision: str = "w3x4y5z6a7b8"
down_revision: str = "v2w3x4y5z6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("appointments", "patient_id", nullable=True)
    op.add_column("appointments", sa.Column("guest_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("appointments", "guest_name")
    op.alter_column("appointments", "patient_id", nullable=False)
