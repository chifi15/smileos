"""add user_days_off table

Revision ID: ze01doctordaysoff2026
Revises: zd01doctorcolor2026
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "ze01doctordaysoff2026"
down_revision = "zd01doctorcolor2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_days_off",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("description", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date"),
    )
    op.create_index("ix_user_days_off_user_id", "user_days_off", ["user_id"])
    op.create_index("ix_user_days_off_clinic_id", "user_days_off", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("ix_user_days_off_clinic_id", table_name="user_days_off")
    op.drop_index("ix_user_days_off_user_id", table_name="user_days_off")
    op.drop_table("user_days_off")
