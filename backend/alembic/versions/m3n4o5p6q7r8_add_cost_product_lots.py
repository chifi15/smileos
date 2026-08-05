"""add cost_product_lots table

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'm3n4o5p6q7r8'
down_revision: Union[str, None] = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'cost_product_lots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', UUID(as_uuid=True), sa.ForeignKey('cost_products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('opened_at', sa.Date(), nullable=False),
        sa.Column('expected_portions', sa.Float(), nullable=True),
        sa.Column('used_portions', sa.Float(), nullable=False, server_default='0'),
        sa.Column('finished_at', sa.Date(), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_cost_product_lots_product_id', 'cost_product_lots', ['product_id'])
    op.create_index('ix_cost_product_lots_clinic_id', 'cost_product_lots', ['clinic_id'])


def downgrade() -> None:
    op.drop_index('ix_cost_product_lots_clinic_id', 'cost_product_lots')
    op.drop_index('ix_cost_product_lots_product_id', 'cost_product_lots')
    op.drop_table('cost_product_lots')
