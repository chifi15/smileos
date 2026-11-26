"""treatment_plan_items.custom_name: nombre editable del tratamiento en el plan

Revision ID: zr01itemcustomname2026
Revises: zq01distributionamount2026
Create Date: 2026-11-25 22:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "zr01itemcustomname2026"
down_revision: Union[str, None] = "zq01distributionamount2026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("treatment_plan_items", sa.Column("custom_name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("treatment_plan_items", "custom_name")
