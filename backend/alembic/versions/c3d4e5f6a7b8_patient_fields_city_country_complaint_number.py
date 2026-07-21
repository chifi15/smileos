"""Add city, country, chief_complaint, patient_number to patients

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('patients', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('patients', sa.Column('country', sa.String(100), nullable=True))
    op.add_column('patients', sa.Column('chief_complaint', sa.Text(), nullable=True))
    op.add_column('patients', sa.Column('patient_number', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('patients', 'patient_number')
    op.drop_column('patients', 'chief_complaint')
    op.drop_column('patients', 'country')
    op.drop_column('patients', 'city')
