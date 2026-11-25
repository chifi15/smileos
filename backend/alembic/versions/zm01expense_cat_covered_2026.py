"""expense_categories.covered_by_op_costs: egresos ya cubiertos por costos operativos

Revision ID: zm01expensecovered2026
Revises: zl01odontoicdas2026
Create Date: 2026-11-25
"""
from alembic import op
import sqlalchemy as sa

revision = "zm01expensecovered2026"
down_revision = "zl01odontoicdas2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "expense_categories",
        sa.Column("covered_by_op_costs", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("expense_categories", "covered_by_op_costs")
