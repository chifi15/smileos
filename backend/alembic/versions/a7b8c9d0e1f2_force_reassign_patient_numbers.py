"""Force reassign patient_number to all patients in created_at order

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa

revision = 'a7b8c9d0e1f2'
down_revision = 'f6a7b8c9d0e1'
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
            ) sub
            WHERE p.id = sub.id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END
        $$;
    """))


def downgrade():
    pass
