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
        WITH reranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY created_at) AS new_num
            FROM patients
        )
        UPDATE patients
        SET patient_number = reranked.new_num
        FROM reranked
        WHERE patients.id = reranked.id
    """))


def downgrade():
    pass
