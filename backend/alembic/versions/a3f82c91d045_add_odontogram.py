"""add_odontogram

Revision ID: a3f82c91d045
Revises: 17e33bd2491e
Create Date: 2026-07-19 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'a3f82c91d045'
down_revision: Union[str, None] = '17e33bd2491e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'odontogram_teeth',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('tooth_number', sa.Integer(), nullable=False),
        sa.Column('condition', sa.String(30), nullable=False, server_default='sano'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('patient_id', 'tooth_number', name='uq_odontogram_patient_tooth'),
    )
    op.create_index('ix_odontogram_teeth_patient', 'odontogram_teeth', ['clinic_id', 'patient_id'])

    op.create_table(
        'odontogram_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=False),
        sa.Column('teeth_data', postgresql.JSON(), nullable=False),
        sa.Column('snapshot_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_odontogram_snapshots_patient', 'odontogram_snapshots', ['clinic_id', 'patient_id'])


def downgrade() -> None:
    op.drop_index('ix_odontogram_snapshots_patient', 'odontogram_snapshots')
    op.drop_table('odontogram_snapshots')
    op.drop_index('ix_odontogram_teeth_patient', 'odontogram_teeth')
    op.drop_table('odontogram_teeth')
