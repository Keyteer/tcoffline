"""
# Add motivo_consulta to episodes and nombre to users

1. Changes to Episodes Table
  - Add `motivo_consulta` (Text, nullable) - Reason for consultation
  - This field will be included in HL7 messages in segment PV2.3

2. Changes to Users Table
  - Add `nombre` (String(200), nullable) - Full name of the user
  - This field will be stored when creating clinical notes

3. Changes to Clinical Notes Table
  - Add `author_nombre` (String(200), nullable) - Author full name snapshot
  - This field captures the author's name at the time of note creation

4. Notes
  - All fields are nullable to maintain compatibility with existing data
  - motivo_consulta will be sent in ADT^A01 and ORU^R01 messages
  - nombre will be captured and stored in clinical note records
"""

revision = '005'
down_revision = '004'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Add motivo_consulta to episodes
    with op.batch_alter_table('episodes') as batch_op:
        batch_op.add_column(sa.Column('motivo_consulta', sa.Text, nullable=True))

    # Add nombre to users
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('nombre', sa.String(200), nullable=True))

    # Add author_nombre to clinical_notes
    with op.batch_alter_table('clinical_notes') as batch_op:
        batch_op.add_column(sa.Column('author_nombre', sa.String(200), nullable=True))


def downgrade():
    # Remove author_nombre from clinical_notes
    with op.batch_alter_table('clinical_notes') as batch_op:
        batch_op.drop_column('author_nombre')

    # Remove motivo_consulta from episodes
    with op.batch_alter_table('episodes') as batch_op:
        batch_op.drop_column('motivo_consulta')

    # Remove nombre from users
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('nombre')
