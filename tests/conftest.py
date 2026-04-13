"""
Shared test fixtures for TrakCare Offline backend tests.

Runs against PostgreSQL (same engine as production).
The test database is created automatically if it doesn't exist.
Each test gets a clean slate via table truncation.
"""
import os

# ---- Set test DATABASE_URL BEFORE any app imports ----
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://tcoffline:tcoffline@db:5432/tcoffline_test",
)

import pytest
from unittest.mock import AsyncMock, patch
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

# ---- Ensure test database exists (connect to 'postgres' to create it) ----
_db_url = os.environ["DATABASE_URL"]
_server_url = _db_url.rsplit("/", 1)[0] + "/postgres"
_db_name = _db_url.rsplit("/", 1)[1].split("?")[0]

_admin_engine = create_engine(_server_url, isolation_level="AUTOCOMMIT")
with _admin_engine.connect() as _conn:
    if not _conn.execute(
        text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": _db_name}
    ).scalar():
        _conn.execute(text(f'CREATE DATABASE "{_db_name}"'))
_admin_engine.dispose()

# ---- Now safe to import app (reads DATABASE_URL from env) ----
from app.db import Base, get_db, engine
from app import models


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def _setup_tables():
    """Drop and recreate all tables once per test session."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db(_setup_tables):
    """Yield a DB session; truncate all tables after each test."""
    session = Session(bind=engine, autocommit=False, autoflush=False)
    yield session
    session.close()
    # Clean all data so the next test starts fresh
    with engine.connect() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())
        conn.commit()


@pytest.fixture()
def client(db):
    """
    FastAPI TestClient wired to the per-test database session.
    Startup sync and background tasks are mocked out.
    """
    from app.main import app

    def _override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db

    # Mock out startup tasks that call the real central server
    with patch("app.sync_service.sync_from_central", new_callable=AsyncMock), \
         patch("app.background_tasks.start_background_tasks", new_callable=AsyncMock):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# User helpers
# ---------------------------------------------------------------------------

DEFAULT_PASSWORD = "testpass123"


def _make_user(db, *, username: str, is_admin: bool = False, active: bool = True) -> models.User:
    user = models.User(
        username=username,
        hashed_password=models.User.hash_password(DEFAULT_PASSWORD),
        role="admin" if is_admin else "user",
        is_admin=is_admin,
        active=active,
        nombre=f"Test {username}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_user(db) -> models.User:
    return _make_user(db, username="admin", is_admin=True)


@pytest.fixture()
def regular_user(db) -> models.User:
    return _make_user(db, username="user1", is_admin=False)


@pytest.fixture()
def inactive_user(db) -> models.User:
    return _make_user(db, username="inactive", active=False)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def auth_headers(client: TestClient, username: str, password: str = DEFAULT_PASSWORD) -> dict:
    """Login via /auth/login and return Bearer token headers."""
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def admin_headers(client, admin_user) -> dict:
    return auth_headers(client, admin_user.username)


@pytest.fixture()
def user_headers(client, regular_user) -> dict:
    return auth_headers(client, regular_user.username)


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def make_episode_payload(**overrides) -> dict:
    """Return a valid EpisodeCreate payload dict."""
    data = {
        "mrn": "MRN001",
        "num_episodio": "EP001",
        "paciente": "García Juan",
        "tipo": "Ambulatorio",
        "hospital": "Hospital Test",
        "ubicacion": "Urgencias",
        "estado": "Activo",
        "data_json": {"MRN": "MRN001", "NumEpisodio": "EP001"},
    }
    data.update(overrides)
    return data
