"""make hl7_payload nullable

Revision ID: 003_make_hl7_payload_nullable
Revises: 002_add_profesional_field
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_label = None
depends_on = None


def upgrade():
    # SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
    with op.batch_alter_table('outbox_events', schema=None) as batch_op:
        batch_op.alter_column('hl7_payload',
                              existing_type=sa.Text(),
                              nullable=True)


def downgrade():
    with op.batch_alter_table('outbox_events', schema=None) as batch_op:
        batch_op.alter_column('hl7_payload',
                              existing_type=sa.Text(),
                              nullable=False)
