"""treatment_plans.sort_order: orden manual de los planes de un paciente

Revision ID: zs01plansortorder2026
Revises: zr01itemcustomname2026
Create Date: 2026-11-25 22:20:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "zs01plansortorder2026"
down_revision: Union[str, None] = "zr01itemcustomname2026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "treatment_plans",
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("treatment_plans", "sort_order")
