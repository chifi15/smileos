"""plan items y transacciones vinculados a cost_treatments (Costos Operativos)

- Crea un cost_treatment por cada procedimiento del catálogo que no tenga uno vinculado.
- treatment_plan_items.cost_treatment_id (backfill desde el vínculo); procedure_id pasa a nullable.
- finance_transactions.cost_treatment_id: backfill desde procedure_id cuando estaba vacío.
No elimina nada: procedure_catalog y las columnas procedure_id se conservan.

Revision ID: zj01plancosttreat2026
Revises: zi01scalefees2026
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "zj01plancosttreat2026"
down_revision = "zi01scalefees2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Un tratamiento de costos por cada procedimiento del catálogo sin vincular
    op.execute(
        """
        INSERT INTO cost_treatments
            (id, clinic_id, name, description, professional_fee_per_hour, total_hours,
             fixed_costs, clinic_margin_pct, suggested_price, procedure_catalog_id, sort_order)
        SELECT gen_random_uuid(), pc.clinic_id, pc.name, LEFT(pc.description, 500), 0, 1,
               0, 0.15, pc.default_price, pc.id, COALESCE(pc.sort_order, 0)
        FROM procedure_catalog pc
        WHERE NOT EXISTS (
            SELECT 1 FROM cost_treatments ct WHERE ct.procedure_catalog_id = pc.id
        )
        """
    )

    # 2) Plan items
    op.add_column(
        "treatment_plan_items",
        sa.Column("cost_treatment_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_plan_items_cost_treatment", "treatment_plan_items", "cost_treatments",
        ["cost_treatment_id"], ["id"], ondelete="SET NULL",
    )
    op.create_index("ix_plan_items_cost_treatment", "treatment_plan_items", ["cost_treatment_id"])
    op.execute(
        """
        UPDATE treatment_plan_items i
        SET cost_treatment_id = (
            SELECT ct.id FROM cost_treatments ct
            WHERE ct.procedure_catalog_id = i.procedure_id
            ORDER BY ct.created_at LIMIT 1
        )
        WHERE i.procedure_id IS NOT NULL
        """
    )
    op.alter_column("treatment_plan_items", "procedure_id", nullable=True)

    # 3) Transacciones de finanzas
    op.execute(
        """
        UPDATE finance_transactions t
        SET cost_treatment_id = (
            SELECT ct.id FROM cost_treatments ct
            WHERE ct.procedure_catalog_id = t.procedure_id
            ORDER BY ct.created_at LIMIT 1
        )
        WHERE t.cost_treatment_id IS NULL AND t.procedure_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index("ix_plan_items_cost_treatment", table_name="treatment_plan_items")
    op.drop_constraint("fk_plan_items_cost_treatment", "treatment_plan_items", type_="foreignkey")
    op.drop_column("treatment_plan_items", "cost_treatment_id")
