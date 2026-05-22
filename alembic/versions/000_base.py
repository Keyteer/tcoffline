"""
# Base revision placeholder

Empty base migration to anchor the revision chain.
If the database was previously stamped with '000', this resolves
the "Can't locate revision '000'" error.

Revision ID: 000
Revises:
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa

revision = '000'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
