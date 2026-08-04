"""audit_log_patient_description

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, None] = 'a7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_logs', sa.Column('patient_id', sa.UUID(), nullable=True))
    op.add_column('audit_logs', sa.Column('description', sa.Text(), nullable=True))
    op.create_foreign_key(
        'fk_audit_logs_patient_id',
        'audit_logs', 'patients',
        ['patient_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_audit_logs_clinic_created', 'audit_logs', ['clinic_id', 'created_at'])
    op.create_index('ix_audit_logs_clinic_patient_created', 'audit_logs', ['clinic_id', 'patient_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_audit_logs_clinic_patient_created', table_name='audit_logs')
    op.drop_index('ix_audit_logs_clinic_created', table_name='audit_logs')
    op.drop_constraint('fk_audit_logs_patient_id', 'audit_logs', type_='foreignkey')
    op.drop_column('audit_logs', 'description')
    op.drop_column('audit_logs', 'patient_id')
