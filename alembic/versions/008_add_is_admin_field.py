"""
# Add is_admin field to users table

1. Changes
   - Add `is_admin` column to `users` table (Boolean, default=False)

2. Purpose
   - Control access to system configuration (read-only mode)
   - Only administrators can enable/disable the read-only mode
   - Separates admin privileges from regular users
"""

from alembic import op
import sqlalchemy as sa


revision = '008'
down_revision = '007'


def upgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('is_admin', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade():
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('is_admin')
