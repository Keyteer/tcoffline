"""
Migrate data from SQLite to PostgreSQL.

Usage:
    python migrate_sqlite_to_pg.py [--sqlite-path ./local.db] [--pg-url postgresql://tcoffline:tcoffline@localhost:5432/tcoffline]

Prerequisites:
    - PostgreSQL database must exist and be empty
    - Run `alembic upgrade head` against PostgreSQL first to create the schema
"""
import argparse
import json
import sqlite3
import sys

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session


TABLES_IN_ORDER = [
    "users",
    "episodes",
    "clinical_notes",
    "outbox_events",
    "sync_state",
]


def migrate(sqlite_path: str, pg_url: str):
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    pg_engine = create_engine(pg_url)

    for table in TABLES_IN_ORDER:
        rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  {table}: 0 rows (skip)")
            continue

        columns = rows[0].keys()

        with Session(pg_engine) as session:
            for row in rows:
                values = {}
                for col in columns:
                    val = row[col]
                    # Convert TEXT JSON to dict for JSONB columns
                    if table == "episodes" and col == "data_json" and isinstance(val, str):
                        val = json.loads(val)
                    values[col] = val

                cols_str = ", ".join(columns)
                placeholders = ", ".join(f":{c}" for c in columns)
                stmt = text(
                    f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders}) "
                    f"ON CONFLICT DO NOTHING"
                )
                session.execute(stmt, values)

            session.commit()

        print(f"  {table}: {len(rows)} rows migrated")

    # Reset sequences to max(id) + 1
    with Session(pg_engine) as session:
        for table in TABLES_IN_ORDER:
            try:
                result = session.execute(
                    text(f"SELECT MAX(id) FROM {table}")
                ).scalar()
                if result is not None:
                    session.execute(
                        text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), :val)")
                        , {"val": result}
                    )
            except Exception:
                pass  # Table may not have a serial id
        session.commit()

    sqlite_conn.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate SQLite data to PostgreSQL")
    parser.add_argument(
        "--sqlite-path", default="./local.db",
        help="Path to the SQLite database file (default: ./local.db)"
    )
    parser.add_argument(
        "--pg-url",
        default="postgresql://tcoffline:tcoffline@localhost:5432/tcoffline",
        help="PostgreSQL connection URL"
    )
    args = parser.parse_args()

    print(f"Migrating from {args.sqlite_path} to PostgreSQL...")
    migrate(args.sqlite_path, args.pg_url)
