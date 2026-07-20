"""rewards_config: add level_benefits column

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-07-20

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'rewards_config',
        sa.Column('level_benefits', JSONB, nullable=False, server_default='{}'),
    )


def downgrade():
    op.drop_column('rewards_config', 'level_benefits')
