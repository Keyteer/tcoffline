"""
# Move read-only mode to global setting

1. Changes
   - Remove `enable_read_only_mode` column from `users` table
   - Add global setting in `sync_state` table with key 'enable_read_only_mode'

2. Purpose
   - Make read-only mode a system-wide setting instead of per-user
   - Store the setting in the sync_state table for easy access
   - Default value is 'true' to maintain backward compatibility
"""

from alembic import op
import sqlalchemy as sa


revision = '007'
down_revision = '006'


def upgrade():
    # Initialize global setting in sync_state
    op.execute("""
        INSERT INTO sync_state (key, value, updated_at)
        VALUES ('enable_read_only_mode', 'true', NOW())
        ON CONFLICT (key) DO NOTHING
    """)

    # Remove enable_read_only_mode from users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('enable_read_only_mode')


def downgrade():
    # Re-add enable_read_only_mode to users table
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('enable_read_only_mode', sa.Boolean(), server_default=sa.text('true'), nullable=False))

    # Remove global setting from sync_state
    op.execute("DELETE FROM sync_state WHERE key = 'enable_read_only_mode'")
