"""
# Initial Simplified Structure

1. New Tables
   - `users` - User accounts
   - `episodes` - Single table storing complete episode JSON data
   - `clinical_notes` - Clinical notes linked to episodes
   - `outbox_events` - Event outbox for sync
   - `sync_state` - Sync state tracking

2. Episodes Table Structure
   - `id` (int, primary key)
   - `mrn` (string, indexed) - Medical Record Number
   - `num_episodio` (string, unique, indexed) - Episode number
   - `run` (string) - Patient RUN
   - `paciente` (string) - Patient name
   - `fecha_nacimiento` (datetime) - Birth date
   - `sexo` (string) - Gender
   - `tipo` (string) - Episode type
   - `fecha_atencion` (datetime, indexed) - Attention date
   - `hospital` (string) - Hospital name
   - `habitacion` (string) - Room
   - `cama` (string) - Bed
   - `ubicacion` (string) - Location
   - `estado` (string) - Status
   - `data_json` (text) - Complete JSON data including Antecedentes
   - `created_at` (datetime)
   - `updated_at` (datetime)
   - `synced_flag` (boolean)

3. Security
   - Foreign keys on clinical_notes
   - Indexes for performance
"""

from alembic import op
import sqlalchemy as sa


revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    op.create_table(
        'episodes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('mrn', sa.String(length=50), nullable=False),
        sa.Column('num_episodio', sa.String(length=50), nullable=False),
        sa.Column('run', sa.String(length=20), nullable=True),
        sa.Column('paciente', sa.String(length=200), nullable=True),
        sa.Column('fecha_nacimiento', sa.DateTime(), nullable=True),
        sa.Column('sexo', sa.String(length=10), nullable=True),
        sa.Column('tipo', sa.String(length=50), nullable=True),
        sa.Column('fecha_atencion', sa.DateTime(), nullable=True),
        sa.Column('hospital', sa.String(length=100), nullable=True),
        sa.Column('habitacion', sa.String(length=50), nullable=True),
        sa.Column('cama', sa.String(length=50), nullable=True),
        sa.Column('ubicacion', sa.String(length=100), nullable=True),
        sa.Column('estado', sa.String(length=50), nullable=True),
        sa.Column('data_json', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('synced_flag', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_episodes_mrn', 'episodes', ['mrn'])
    op.create_index('ix_episodes_num_episodio', 'episodes', ['num_episodio'], unique=True)
    op.create_index('ix_episodes_fecha_atencion', 'episodes', ['fecha_atencion'])

    op.create_table(
        'clinical_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('episode_id', sa.Integer(), nullable=False),
        sa.Column('author_user_id', sa.Integer(), nullable=False),
        sa.Column('note_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('synced_flag', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.ForeignKeyConstraint(['episode_id'], ['episodes.id'], ),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_clinical_notes_episode_id', 'clinical_notes', ['episode_id'])

    op.create_table(
        'outbox_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('correlation_id', sa.String(length=100), nullable=False),
        sa.Column('hl7_payload', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('priority', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table(
        'sync_state',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sync_state_key', 'sync_state', ['key'], unique=True)


def downgrade():
    op.drop_table('sync_state')
    op.drop_table('outbox_events')
    op.drop_table('clinical_notes')
    op.drop_table('episodes')
    op.drop_table('users')
