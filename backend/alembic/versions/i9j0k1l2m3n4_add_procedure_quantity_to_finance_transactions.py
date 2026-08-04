"""add procedure_quantity to finance_transactions

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'i9j0k1l2m3n4'
down_revision: Union[str, None] = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'finance_transactions',
        sa.Column('procedure_quantity', sa.Integer(), server_default='1', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('finance_transactions', 'procedure_quantity')
