"""add whatsapp_conversations

Revision ID: wa01whatsapp2026
Revises: z6a7b8c9d0e1
Create Date: 2026-09-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "wa01whatsapp2026"
down_revision = "h1o2n3o4r5a6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "whatsapp_conversations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("wa_id", sa.String(30), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_whatsapp_conversations_clinic_wa",
        "whatsapp_conversations",
        ["clinic_id", "wa_id"],
    )


def downgrade():
    op.drop_index("ix_whatsapp_conversations_clinic_wa", table_name="whatsapp_conversations")
    op.drop_table("whatsapp_conversations")
