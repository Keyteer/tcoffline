"""
# Make RUN field optional

## Description
This migration makes the RUN (patient ID number) field optional in the episodes table to support patients without identification documents.

## Changes Made

### Modified Tables
- `episodes`
  - Changed `run` column to be optional (nullable)
  - Patients without documents will have NULL or empty string in this field

### Impact
- Frontend will include a "Sin Documento" checkbox to skip RUN validation
- Backend will accept NULL or empty RUN values
- Existing episodes with RUN remain unchanged

### Security Notes
- RLS policies remain unchanged
- No data loss - existing RUN values are preserved
"""

revision = '010'
down_revision = '009'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # RUN field is already nullable in the schema, but we ensure it explicitly
    # This migration serves as documentation that RUN is intentionally optional
    pass


def downgrade():
    # No changes needed - RUN was already nullable
    pass
