"""
# Initial PostgreSQL Schema for TrakCare Offline LAN

## Summary
Full schema creation for the LAN version. Migrated from SQLite to PostgreSQL with
timezone-aware timestamps and connection pooling support.

## New Tables

### users
- id, username (unique), hashed_password, role, active, is_admin
- nombre: display name used in HL7 OBR.24
- filtros: query string params passed to central getData API (e.g. "user=doc1&unit=UCI")
- last_login: timezone-aware timestamp; updated on each JWT login
- updated_at: auto-updated timestamp

### episodes
- Full patient episode record with indexed fields for list queries
- data_json: raw JSON blob from central API for detail view
- synced_flag: True when the episode originated from or was confirmed by central
- All DateTime columns are timezone-aware

### clinical_notes
- author_user_id: FK to users — records the session user who wrote the note
- author_nombre: denormalized display name at write time

### outbox_events
- Async outbox for reliable upstream sync to central (HL7 messages)
- author_user_id: FK to users — records the SESSION USER at event creation time
  This is critical for session-safety: the outbox processor reads this field
  to populate HL7 OBR.24 (sending user), never queries by last_login
- status: pending / sent / failed
- retry_count, last_error: retry tracking

### sync_state
- Key-value store for sync metadata (last_sync, last_upstream_sync, settings)

## Security Notes
- Passwords stored as bcrypt hashes
- JWT tokens signed with SECRET_KEY from .env
- No plaintext credentials stored

Revision ID: 001
Revises:
Create Date: 2026-05-19
"""

from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = '000'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL NOT NULL,
            username VARCHAR(50) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            role VARCHAR(20) DEFAULT 'user',
            active BOOLEAN DEFAULT true,
            is_admin BOOLEAN DEFAULT false,
            nombre VARCHAR(200),
            filtros TEXT,
            last_login TIMESTAMP WITH TIME ZONE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            PRIMARY KEY (id)
        )
    """))
    conn.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_users_id ON users (id)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS episodes (
            id SERIAL NOT NULL,
            mrn VARCHAR(50) NOT NULL,
            num_episodio VARCHAR(50) NOT NULL,
            run VARCHAR(20),
            paciente VARCHAR(200),
            fecha_nacimiento TIMESTAMP WITH TIME ZONE,
            sexo VARCHAR(10),
            tipo VARCHAR(50),
            fecha_atencion TIMESTAMP WITH TIME ZONE,
            hospital VARCHAR(100),
            habitacion VARCHAR(50),
            cama VARCHAR(50),
            ubicacion VARCHAR(100),
            estado VARCHAR(50),
            profesional VARCHAR(200),
            motivo_consulta TEXT,
            data_json TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            synced_flag BOOLEAN DEFAULT false,
            PRIMARY KEY (id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_episodes_id ON episodes (id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_episodes_mrn ON episodes (mrn)"))
    conn.execute(sa.text("CREATE UNIQUE INDEX IF NOT EXISTS ix_episodes_num_episodio ON episodes (num_episodio)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_episodes_fecha_atencion ON episodes (fecha_atencion)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS clinical_notes (
            id SERIAL NOT NULL,
            episode_id INTEGER NOT NULL,
            author_user_id INTEGER NOT NULL,
            author_nombre VARCHAR(200),
            note_text TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            synced_flag BOOLEAN DEFAULT false,
            PRIMARY KEY (id),
            FOREIGN KEY (episode_id) REFERENCES episodes (id),
            FOREIGN KEY (author_user_id) REFERENCES users (id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_clinical_notes_id ON clinical_notes (id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_clinical_notes_episode_id ON clinical_notes (episode_id)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS outbox_events (
            id SERIAL NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            correlation_id VARCHAR(100) NOT NULL,
            hl7_payload TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            priority INTEGER DEFAULT 5,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            retry_count INTEGER DEFAULT 0,
            last_error TEXT,
            author_user_id INTEGER,
            PRIMARY KEY (id),
            FOREIGN KEY (author_user_id) REFERENCES users (id)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_outbox_events_id ON outbox_events (id)"))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS sync_state (
            id SERIAL NOT NULL,
            key VARCHAR(100) NOT NULL,
            value TEXT,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            PRIMARY KEY (id),
            UNIQUE (key)
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sync_state_id ON sync_state (id)"))

    # Add author_user_id to outbox_events if it was created without it (pre-existing schema)
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'outbox_events' AND column_name = 'author_user_id'
            ) THEN
                ALTER TABLE outbox_events ADD COLUMN author_user_id INTEGER REFERENCES users(id);
            END IF;
        END $$
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS sync_state"))
    conn.execute(sa.text("DROP TABLE IF EXISTS outbox_events"))
    conn.execute(sa.text("DROP TABLE IF EXISTS clinical_notes"))
    conn.execute(sa.text("DROP TABLE IF EXISTS episodes"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users"))
