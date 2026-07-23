"""Backfill patient_number for existing patients without number

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-23

"""
from alembic import op

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        WITH ranked AS (
            SELECT id, clinic_id,
                   ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at) AS rn
            FROM patients
            WHERE patient_number IS NULL
        ),
        max_per_clinic AS (
            SELECT clinic_id, COALESCE(MAX(patient_number), 0) AS max_num
            FROM patients
            WHERE patient_number IS NOT NULL
            GROUP BY clinic_id
        )
        UPDATE patients
        SET patient_number = COALESCE(mpc.max_num, 0) + ranked.rn
        FROM ranked
        LEFT JOIN max_per_clinic mpc ON mpc.clinic_id = ranked.clinic_id
        WHERE patients.id = ranked.id
    """)


def downgrade():
    pass
