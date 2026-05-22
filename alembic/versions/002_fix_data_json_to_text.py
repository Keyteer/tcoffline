"""
# Fix data_json column type to TEXT

## Summary
Ensures the data_json column in the episodes table is stored as TEXT (not JSONB/JSON).
This fixes a serialization bug where SQLAlchemy returns a dict instead of a string
when the column type is JSONB, causing 500 errors in list and detail endpoints.

## Changes
- episodes.data_json: cast from current type to TEXT if not already TEXT
- Existing data is preserved via CAST

Revision ID: 002
Revises: 001
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'episodes'
                  AND column_name = 'data_json'
                  AND data_type IN ('json', 'jsonb')
            ) THEN
                ALTER TABLE episodes
                    ALTER COLUMN data_json TYPE TEXT USING data_json::text;
            END IF;
        END $$
    """))


def downgrade() -> None:
    pass
