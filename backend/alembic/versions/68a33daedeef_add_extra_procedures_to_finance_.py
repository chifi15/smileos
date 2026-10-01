"""add extra_procedures to finance_transactions

Revision ID: 68a33daedeef
Revises: wa01whatsapp2026
Create Date: 2026-10-01 07:32:28.500311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '68a33daedeef'
down_revision: Union[str, None] = 'wa01whatsapp2026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'finance_transactions',
        sa.Column('extra_procedures', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('finance_transactions', 'extra_procedures')
