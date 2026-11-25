"""expense_categories.fixed_cost_item_id: vínculo costo fijo (presupuesto) ↔ categoría de egreso (real)

Revision ID: zn01expensefixedlink2026
Revises: zm01expensecovered2026
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa

revision = "zn01expensefixedlink2026"
down_revision = "zm01expensecovered2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("expense_categories", sa.Column("fixed_cost_item_id", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("expense_categories", "fixed_cost_item_id")
