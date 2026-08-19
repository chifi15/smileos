"""add expense_categories table per clinic

Revision ID: p6q7r8s9t0u1
Revises: o5p6q7r8s9t0
Create Date: 2026-08-19
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'p6q7r8s9t0u1'
down_revision: str = 'o5p6q7r8s9t0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expense_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("sort_order", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("clinic_id", "key", name="uq_expense_categories_clinic_key"),
    )
    op.create_index("ix_expense_categories_clinic", "expense_categories", ["clinic_id"])


def downgrade() -> None:
    op.drop_index("ix_expense_categories_clinic", table_name="expense_categories")
    op.drop_table("expense_categories")
