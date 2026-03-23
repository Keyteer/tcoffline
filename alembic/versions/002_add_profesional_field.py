"""
# Add profesional field to episodes

1. Changes
   - Add `profesional` column to `episodes` table
   - Column stores the professional/doctor assigned to the episode
   - Nullable string field, up to 200 characters

2. Purpose
   - Map the "Profesional" field from the JSON data to the database
   - Enable filtering and display of the assigned professional for each episode
"""

from alembic import op
import sqlalchemy as sa


revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('episodes', sa.Column('profesional', sa.String(length=200), nullable=True))


def downgrade() -> None:
    op.drop_column('episodes', 'profesional')
