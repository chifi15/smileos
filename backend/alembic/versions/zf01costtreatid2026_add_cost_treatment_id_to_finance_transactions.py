"""backfill cost_treatment_id in finance_transactions via procedure_catalog_id link

Revision ID: zf01costtreatid2026
Revises: zh01costtxlink2026
Create Date: 2026-11-05
"""
from alembic import op

revision = "zf01costtreatid2026"
down_revision = "zh01costtxlink2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Column was already added by zh01costtxlink2026.
    # Backfill cost_treatment_id for existing transactions that referenced a
    # catalog procedure linked to a CostTreatment.
    op.execute("""
        UPDATE finance_transactions ft
        SET cost_treatment_id = ct.id
        FROM cost_treatments ct
        WHERE ct.procedure_catalog_id = ft.procedure_id
          AND ft.cost_treatment_id IS NULL
          AND ft.procedure_id IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE finance_transactions
        SET cost_treatment_id = NULL
        WHERE cost_treatment_id IS NOT NULL
    """)
