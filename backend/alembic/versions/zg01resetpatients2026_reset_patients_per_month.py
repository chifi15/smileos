"""reset patients_per_month to 0 for all non-admin clinics

Revision ID: zg01resetpatients2026
Revises: zf01features2026
Create Date: 2026-10-30
"""
from alembic import op
import sqlalchemy as sa

revision = "zg01resetpatients2026"
down_revision = "zf01features2026"
branch_labels = None
depends_on = None

ADMIN_EMAIL = "admin@smileos.ni"


def upgrade() -> None:
    conn = op.get_bind()
    # Encuentra el clinic_id del admin para excluirlo
    row = conn.execute(
        sa.text("SELECT clinic_id FROM users WHERE email = :email LIMIT 1"),
        {"email": ADMIN_EMAIL},
    ).fetchone()
    admin_clinic_id = row[0] if row else None

    if admin_clinic_id:
        conn.execute(
            sa.text(
                "UPDATE fixed_costs_config SET patients_per_month = 0 "
                "WHERE clinic_id != :admin_clinic_id"
            ),
            {"admin_clinic_id": admin_clinic_id},
        )
    else:
        conn.execute(
            sa.text("UPDATE fixed_costs_config SET patients_per_month = 0")
        )


def downgrade() -> None:
    op.execute("UPDATE fixed_costs_config SET patients_per_month = 40")
