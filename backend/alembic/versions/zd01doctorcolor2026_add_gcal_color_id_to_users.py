"""add gcal_color_id to users

Revision ID: zd01doctorcolor2026
Revises: zc01synctokens2026
Create Date: 2026-10-21
"""
from alembic import op
import sqlalchemy as sa

revision = "zd01doctorcolor2026"
down_revision = "zc01synctokens2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("gcal_color_id", sa.String(2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "gcal_color_id")
