"""add purchase_date to cost_products

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'l2m3n4o5p6q7'
down_revision: Union[str, None] = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cost_products', sa.Column('purchase_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('cost_products', 'purchase_date')
