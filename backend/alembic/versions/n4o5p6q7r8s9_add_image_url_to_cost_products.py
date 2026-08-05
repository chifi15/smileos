"""add image_url to cost_products

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'n4o5p6q7r8s9'
down_revision: Union[str, None] = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('cost_products', sa.Column('image_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('cost_products', 'image_url')
