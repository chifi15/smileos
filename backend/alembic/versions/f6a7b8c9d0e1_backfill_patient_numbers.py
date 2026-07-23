"""Backfill patient_number for existing patients without number

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.execute(sa.text("""
        DO $$
        BEGIN
            UPDATE patients p
            SET patient_number = sub.new_num
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at) AS new_num
                FROM patients
                WHERE patient_number IS NULL
            ) sub
            WHERE p.id = sub.id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END
        $$;
    """))


def downgrade():
    pass
