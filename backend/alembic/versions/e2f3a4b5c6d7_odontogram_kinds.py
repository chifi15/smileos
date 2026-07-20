"""odontogram kinds

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-07-19

"""
from alembic import op
import sqlalchemy as sa

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('odontogram_teeth',
        sa.Column('kind', sa.String(20), nullable=False, server_default='inicial'))
    op.add_column('odontogram_snapshots',
        sa.Column('kind', sa.String(20), nullable=False, server_default='inicial'))


def downgrade():
    op.drop_column('odontogram_teeth', 'kind')
    op.drop_column('odontogram_snapshots', 'kind')
