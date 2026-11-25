"""patient_photos.pdf_edit: giro/inversión/inclinación/recorte guardados para el PDF

Revision ID: zk01photopdfedit2026
Revises: zj01plancosttreat2026
Create Date: 2026-11-24
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "zk01photopdfedit2026"
down_revision = "zj01plancosttreat2026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("patient_photos", sa.Column("pdf_edit", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("patient_photos", "pdf_edit")
