"""
# Add enable_read_only_mode field to users

1. Changes
   - Add `enable_read_only_mode` boolean column to `users` table
   - Defaults to True (read-only mode enabled when online)

2. Purpose
   - Allow users to configure whether read-only mode should be enabled when central server is online
   - Provides flexibility for users who want to continue creating episodes even when online
"""

from alembic import op
import sqlalchemy as sa


revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('enable_read_only_mode', sa.Boolean(), nullable=False, server_default='1'))


def downgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('enable_read_only_mode')
