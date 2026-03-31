"""
# Convert data_json from TEXT to JSONB

## Description
Migrates the episodes.data_json column from TEXT to PostgreSQL JSONB type.
Existing TEXT JSON data is cast to JSONB during the migration.

## Changes Made
- `episodes.data_json`: TEXT → JSONB

## Notes
- This migration is PostgreSQL-specific
- Existing JSON strings are automatically parsed into JSONB
"""

revision = '011'
down_revision = '010'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


def upgrade():
    op.execute(
        "ALTER TABLE episodes "
        "ALTER COLUMN data_json TYPE JSONB USING data_json::jsonb"
    )


def downgrade():
    op.execute(
        "ALTER TABLE episodes "
        "ALTER COLUMN data_json TYPE TEXT USING data_json::text"
    )
