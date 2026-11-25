"""odontogram_teeth.icdas: nivel ICDAS (0-6) por pieza

Revision ID: zl01odontoicdas2026
Revises: zk01photopdfedit2026
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa

revision = "zl01odontoicdas2026"
down_revision = "zk01photopdfedit2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("odontogram_teeth", sa.Column("icdas", sa.SmallInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("odontogram_teeth", "icdas")
