"""add cost_treatment_id to finance_transactions

Revision ID: zf01costtreatid2026
Revises: ze01doctordaysoff2026
Create Date: 2026-11-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "zf01costtreatid2026"
down_revision = "ze01doctordaysoff2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "finance_transactions",
        sa.Column("cost_treatment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_finance_transactions_cost_treatment_id",
        "finance_transactions", "cost_treatments",
        ["cost_treatment_id"], ["id"],
        ondelete="SET NULL",
    )
    # Migrate existing procedure_id -> cost_treatment_id via procedure_catalog_id link
    op.execute("""
        UPDATE finance_transactions ft
        SET cost_treatment_id = ct.id
        FROM cost_treatments ct
        WHERE ct.procedure_catalog_id = ft.procedure_id
          AND ft.cost_treatment_id IS NULL
          AND ft.procedure_id IS NOT NULL
    """)


def downgrade() -> None:
    op.drop_constraint("fk_finance_transactions_cost_treatment_id", "finance_transactions", type_="foreignkey")
    op.drop_column("finance_transactions", "cost_treatment_id")
