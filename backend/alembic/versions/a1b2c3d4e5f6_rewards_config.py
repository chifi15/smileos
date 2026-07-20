"""rewards_config: per-clinic configurable points table and level thresholds

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-07-20

"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = 'a1b2c3d4e5f6'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'rewards_config',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinics.id'), unique=True, nullable=False),
        sa.Column('points_overrides', JSONB, nullable=False, server_default='{}'),
        sa.Column('level_overrides', JSONB, nullable=False, server_default='{}'),
        sa.Column('custom_types', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )


def downgrade():
    op.drop_table('rewards_config')
