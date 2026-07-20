"""add_finances

Revision ID: c9d4e5f60123
Revises: b7c1d3e4f502
Create Date: 2026-07-19 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c9d4e5f60123'
down_revision: Union[str, None] = 'b7c1d3e4f502'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Costo operativo en catálogo de procedimientos
    op.add_column('procedure_catalog',
        sa.Column('operational_cost', sa.Numeric(10, 2), nullable=True))

    # 2. Tasa de cambio USD en configuración de clínica
    op.add_column('clinic_settings',
        sa.Column('usd_exchange_rate', sa.Numeric(10, 4), nullable=False, server_default='37.0'))

    # 3. Tabla de transacciones financieras
    op.create_table(
        'finance_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('clinic_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('clinics.id'), nullable=False),
        sa.Column('type', sa.String(10), nullable=False),           # ingreso | egreso
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('amount_cordobas', sa.Numeric(12, 2), nullable=False),
        sa.Column('original_amount', sa.Numeric(12, 2), nullable=True),
        sa.Column('original_currency', sa.String(3), nullable=True),  # NIO | USD
        sa.Column('exchange_rate_used', sa.Numeric(10, 4), nullable=True),
        sa.Column('patient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('patients.id'), nullable=True),
        sa.Column('procedure_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('procedure_catalog.id'), nullable=True),
        sa.Column('operational_cost_snapshot', sa.Numeric(12, 2), nullable=True),
        sa.Column('invoice_number', sa.String(50), nullable=True),
        sa.Column('transaction_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_finance_transactions_clinic_date',
        'finance_transactions', ['clinic_id', 'transaction_date'])


def downgrade() -> None:
    op.drop_index('ix_finance_transactions_clinic_date', 'finance_transactions')
    op.drop_table('finance_transactions')
    op.drop_column('clinic_settings', 'usd_exchange_rate')
    op.drop_column('procedure_catalog', 'operational_cost')
