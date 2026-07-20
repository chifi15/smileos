"""finance_receipt

Revision ID: d1e2f3a4b5c6
Revises: c9d4e5f60123
Create Date: 2026-07-20 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c9d4e5f60123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('finance_transactions',
        sa.Column('receipt_path', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('finance_transactions', 'receipt_path')
