"""costos tables: products, treatments, appointments, fixed_costs_config

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, None] = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'cost_products',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('category', sa.String(50), nullable=False, server_default='otros'),
        sa.Column('unit_price', sa.Float, nullable=False, server_default='0'),
        sa.Column('presentation', sa.String(200), nullable=False, server_default=''),
        sa.Column('portion_description', sa.String(200), nullable=False, server_default=''),
        sa.Column('supplier', sa.String(200), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('total_cost', sa.Float, nullable=True),
        sa.Column('presentation_qty', sa.Float, nullable=True),
        sa.Column('presentation_unit', sa.String(50), nullable=True),
        sa.Column('portion_qty', sa.Float, nullable=True),
        sa.Column('stock_qty', sa.Float, nullable=True),
        sa.Column('min_stock_qty', sa.Float, nullable=True),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_cost_products_clinic_id', 'cost_products', ['clinic_id'])

    op.create_table(
        'cost_treatments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('professional_fee_per_hour', sa.Float, nullable=False, server_default='192'),
        sa.Column('total_hours', sa.Float, nullable=False, server_default='1'),
        sa.Column('fixed_costs', sa.Float, nullable=False, server_default='216'),
        sa.Column('clinic_margin_pct', sa.Float, nullable=False, server_default='0.15'),
        sa.Column('suggested_price', sa.Float, nullable=True),
        sa.Column('procedure_catalog_id', UUID(as_uuid=True), nullable=True),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_cost_treatments_clinic_id', 'cost_treatments', ['clinic_id'])

    op.create_table(
        'cost_appointments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('treatment_id', UUID(as_uuid=True), sa.ForeignKey('cost_treatments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('number', sa.Integer, nullable=False, server_default='1'),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('materials', JSONB, nullable=False, server_default='[]'),
        sa.Column('sort_order', sa.Integer, nullable=False, server_default='0'),
    )
    op.create_index('ix_cost_appointments_treatment_id', 'cost_appointments', ['treatment_id'])

    op.create_table(
        'fixed_costs_config',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('clinic_id', UUID(as_uuid=True), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('patients_per_month', sa.Integer, nullable=False, server_default='40'),
        sa.Column('items', JSONB, nullable=False, server_default='[]'),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('fixed_costs_config')
    op.drop_index('ix_cost_appointments_treatment_id', 'cost_appointments')
    op.drop_table('cost_appointments')
    op.drop_index('ix_cost_treatments_clinic_id', 'cost_treatments')
    op.drop_table('cost_treatments')
    op.drop_index('ix_cost_products_clinic_id', 'cost_products')
    op.drop_table('cost_products')
