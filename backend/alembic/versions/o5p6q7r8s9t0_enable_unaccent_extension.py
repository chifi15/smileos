"""enable unaccent extension for accent-insensitive search

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-08-19
"""
from alembic import op

revision: str = 'o5p6q7r8s9t0'
down_revision: str = 'n4o5p6q7r8s9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS unaccent")
