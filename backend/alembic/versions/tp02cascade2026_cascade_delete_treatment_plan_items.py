"""cascade delete treatment plan items

Revision ID: tp02cascade2026
Revises: z6a7b8c9d0e1
Create Date: 2026-10-19
"""
from alembic import op
import sqlalchemy as sa

revision = "tp02cascade2026"
down_revision = "z6a7b8c9d0e1"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'treatment_plan_items'::regclass
                  AND contype = 'f'
                  AND confrelid = 'treatment_plans'::regclass
            LOOP
                EXECUTE 'ALTER TABLE treatment_plan_items DROP CONSTRAINT ' || quote_ident(r.conname);
            END LOOP;
        END $$;
    """)
    op.create_foreign_key(
        "treatment_plan_items_treatment_plan_id_fkey",
        "treatment_plan_items",
        "treatment_plans",
        ["treatment_plan_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_constraint(
        "treatment_plan_items_treatment_plan_id_fkey",
        "treatment_plan_items",
        type_="foreignkey",
    )
    op.create_foreign_key(
        "treatment_plan_items_treatment_plan_id_fkey",
        "treatment_plan_items",
        "treatment_plans",
        ["treatment_plan_id"],
        ["id"],
    )
