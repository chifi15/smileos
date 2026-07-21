"""add patient_evolutions table

Revision ID: d5e6f7a8b9c0
Revises: c3d4e5f6a7b8
Create Date: 2026-07-20

"""
from alembic import op
from sqlalchemy import text

revision = 'd5e6f7a8b9c0'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS patient_evolutions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id UUID NOT NULL REFERENCES clinics(id),
            patient_id UUID NOT NULL REFERENCES patients(id),
            created_by_id UUID NOT NULL REFERENCES users(id),
            date DATE NOT NULL,
            note TEXT NOT NULL,
            attendance VARCHAR(20),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_patient_evolutions_patient_id
        ON patient_evolutions (patient_id)
    """))
    op.execute(text("""
        CREATE INDEX IF NOT EXISTS ix_patient_evolutions_clinic_id
        ON patient_evolutions (clinic_id)
    """))


def downgrade():
    op.execute(text("DROP TABLE IF EXISTS patient_evolutions"))
