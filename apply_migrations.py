"""
Apply missing migrations to the database
"""
import sqlite3

db_path = "/tmp/cc-agent/63316896/project/local.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Applying migrations...")

# Migration 004: Add filtros to users
try:
    cursor.execute("ALTER TABLE users ADD COLUMN nombre VARCHAR(200)")
    print("  ✓ Added 'nombre' column to users table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("  - 'nombre' column already exists in users table")
    else:
        print(f"  ✗ Error adding 'nombre' column: {e}")

try:
    cursor.execute("ALTER TABLE users ADD COLUMN filtros TEXT")
    print("  ✓ Added 'filtros' column to users table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("  - 'filtros' column already exists in users table")
    else:
        print(f"  ✗ Error adding 'filtros' column: {e}")

# Migration 005: Add motivo_consulta and nombre to episodes
try:
    cursor.execute("ALTER TABLE episodes ADD COLUMN motivo_consulta TEXT")
    print("  ✓ Added 'motivo_consulta' column to episodes table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("  - 'motivo_consulta' column already exists in episodes table")
    else:
        print(f"  ✗ Error adding 'motivo_consulta' column: {e}")

try:
    cursor.execute("ALTER TABLE episodes ADD COLUMN nombre VARCHAR(200)")
    print("  ✓ Added 'nombre' column to episodes table")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("  - 'nombre' column already exists in episodes table")
    else:
        print(f"  ✗ Error adding 'nombre' column: {e}")

conn.commit()
conn.close()

print("\nMigrations applied successfully!")
