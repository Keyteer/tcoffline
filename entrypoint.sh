#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Initializing demo users..."
python init_demo_users.py

echo "Starting uvicorn on port 8000..."
LOG_LEVEL_LOWER=$(echo "${LOG_LEVEL:-warning}" | tr '[:upper:]' '[:lower:]')
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level "$LOG_LEVEL_LOWER"
