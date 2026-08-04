"""add sort_order to procedure_catalog

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-08-04 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'j0k1l2m3n4o5'
down_revision: Union[str, None] = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'procedure_catalog',
        sa.Column('sort_order', sa.Integer(), server_default='0', nullable=False),
    )
    # Backfill: asignar orden alfabético por nombre dentro de cada clínica
    op.execute("""
        UPDATE procedure_catalog p
        SET sort_order = sub.rn - 1
        FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY clinic_id ORDER BY name) AS rn
            FROM procedure_catalog
        ) sub
        WHERE p.id = sub.id
    """)


def downgrade() -> None:
    op.drop_column('procedure_catalog', 'sort_order')
