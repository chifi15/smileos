"""fix odontogram unique constraint to include kind

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-07-19

"""
from alembic import op

revision = 'f3a4b5c6d7e8'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint('uq_odontogram_patient_tooth', 'odontogram_teeth', type_='unique')
    op.create_unique_constraint(
        'uq_odontogram_patient_tooth_kind',
        'odontogram_teeth',
        ['patient_id', 'tooth_number', 'kind']
    )


def downgrade():
    op.drop_constraint('uq_odontogram_patient_tooth_kind', 'odontogram_teeth', type_='unique')
    op.create_unique_constraint(
        'uq_odontogram_patient_tooth',
        'odontogram_teeth',
        ['patient_id', 'tooth_number']
    )
