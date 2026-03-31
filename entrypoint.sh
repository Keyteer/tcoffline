#!/bin/sh
set -e

echo "Running Alembic migrations..."
alembic upgrade head

echo "Initializing demo users..."
python init_demo_users.py

echo "Starting uvicorn on port 8000..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
