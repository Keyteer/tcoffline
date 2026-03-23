"""add last_login field

Revision ID: 009
Revises: 008
Create Date: 2026-03-17

Changes:
- Add last_login timestamp field to users table
- This field tracks when each user last authenticated
- Used by background sync to determine which user's filters to apply
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('last_login', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('users', 'last_login')
