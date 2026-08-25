"""add google calendar ical sync

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-08-24
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'r8s9t0u1v2w3'
down_revision: str = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Campos en clinic_settings
    op.add_column("clinic_settings", sa.Column("ical_url", sa.Text(), nullable=True))
    op.add_column("clinic_settings", sa.Column("calendar_last_synced_at", sa.DateTime(timezone=True), nullable=True))

    # Tabla de eventos de calendario sincronizados
    op.create_table(
        "calendar_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("clinic_id", UUID(as_uuid=True), sa.ForeignKey("clinics.id"), nullable=False),
        sa.Column("ical_uid", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("patient_id", UUID(as_uuid=True), sa.ForeignKey("patients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("match_confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("clinic_id", "ical_uid", name="uq_calendar_events_clinic_ical_uid"),
    )
    op.create_index("ix_calendar_events_clinic_id", "calendar_events", ["clinic_id"])
    op.create_index("ix_calendar_events_start_at", "calendar_events", ["start_at"])
    op.create_index("ix_calendar_events_patient_id", "calendar_events", ["patient_id"])


def downgrade() -> None:
    op.drop_table("calendar_events")
    op.drop_column("clinic_settings", "calendar_last_synced_at")
    op.drop_column("clinic_settings", "ical_url")
