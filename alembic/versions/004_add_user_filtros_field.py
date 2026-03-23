"""add user filtros field

Revision ID: 004_add_user_filtros_field
Revises: 003_make_hl7_payload_nullable
Create Date: 2026-02-27 00:00:00.000000

# Migration: Add filtros field to users table

## Changes Made
1. New Columns
   - `users.filtros` (Text, nullable) - Stores filter parameters for obtenerDatos API requests

## Purpose
This field stores custom filter parameters that will be sent with each GET request to the
obtenerDatos API endpoint. If null, no filters are applied.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_label = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('filtros', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('filtros')
