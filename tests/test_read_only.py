"""
Tests for the read-only mode middleware.

When `enable_read_only_mode` is set to "true" in the SyncState table, all
mutating requests (POST/PUT/PATCH/DELETE) must be rejected with 503, except:
  - /auth/* paths (login, refresh)
  - PUT /settings (so admins can turn the mode off)

Safe (GET/HEAD/OPTIONS) requests must pass through unaffected.
"""
import pytest
from tests.conftest import auth_headers, make_episode_payload
from app import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _set_read_only(db, enabled: bool):
    record = db.query(models.SyncState).filter(
        models.SyncState.key == "enable_read_only_mode"
    ).first()
    value = "true" if enabled else "false"
    if record:
        record.value = value
    else:
        db.add(models.SyncState(key="enable_read_only_mode", value=value))
    db.commit()


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def read_only_client(client, db):
    """Client with read-only mode active."""
    _set_read_only(db, True)
    yield client


@pytest.fixture()
def write_enabled_client(client, db):
    """Client with read-only mode explicitly off."""
    _set_read_only(db, False)
    yield client


# ---------------------------------------------------------------------------
# Core guard — mutations blocked
# ---------------------------------------------------------------------------

class TestMutationsBlocked:
    def test_post_episode_blocked(self, read_only_client, regular_user):
        headers = auth_headers(read_only_client, regular_user.username)
        resp = read_only_client.post(
            "/episodes",
            json=make_episode_payload(),
            headers=headers,
        )
        assert resp.status_code == 503
        assert "solo lectura" in resp.json()["detail"].lower()

    def test_post_note_blocked(self, read_only_client, regular_user, db):
        # We need an existing episode — create it while mode is off, then re-enable
        _set_read_only(db, False)
        headers = auth_headers(read_only_client, regular_user.username)
        ep_resp = read_only_client.post(
            "/episodes", json=make_episode_payload(), headers=headers
        )
        assert ep_resp.status_code == 201
        ep_id = ep_resp.json()["id"]

        _set_read_only(db, True)
        resp = read_only_client.post(
            f"/episodes/{ep_id}/notes",
            json={"note_text": "test note"},
            headers=headers,
        )
        assert resp.status_code == 503

    def test_sync_trigger_blocked(self, read_only_client, regular_user):
        headers = auth_headers(read_only_client, regular_user.username)
        resp = read_only_client.post("/sync/trigger", headers=headers)
        assert resp.status_code == 503

    def test_sync_retry_blocked(self, read_only_client, regular_user):
        headers = auth_headers(read_only_client, regular_user.username)
        resp = read_only_client.post("/sync/retry-failed", headers=headers)
        assert resp.status_code == 503


# ---------------------------------------------------------------------------
# GET requests pass through unaffected
# ---------------------------------------------------------------------------

class TestReadsAllowed:
    def test_get_episodes_allowed(self, read_only_client, regular_user):
        headers = auth_headers(read_only_client, regular_user.username)
        resp = read_only_client.get("/episodes", headers=headers)
        assert resp.status_code == 200

    def test_get_health_allowed(self, read_only_client):
        resp = read_only_client.get("/health")
        assert resp.status_code == 200

    def test_get_settings_allowed(self, read_only_client, regular_user):
        headers = auth_headers(read_only_client, regular_user.username)
        resp = read_only_client.get("/settings", headers=headers)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Exempt paths: /auth/* and PUT /settings
# ---------------------------------------------------------------------------

class TestExemptions:
    def test_login_not_blocked(self, read_only_client, regular_user):
        """POST /auth/login must work even in read-only mode."""
        resp = read_only_client.post(
            "/auth/login",
            json={"username": regular_user.username, "password": "testpass123"},
        )
        assert resp.status_code == 200

    def test_refresh_not_blocked(self, read_only_client, regular_user):
        """POST /auth/refresh must work even in read-only mode."""
        login = read_only_client.post(
            "/auth/login",
            json={"username": regular_user.username, "password": "testpass123"},
        )
        refresh_token = login.json()["refresh_token"]
        resp = read_only_client.post(
            "/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200

    def test_put_settings_not_blocked(self, read_only_client, admin_user):
        """Admin must be able to update settings to turn read-only mode off."""
        headers = auth_headers(read_only_client, admin_user.username)
        resp = read_only_client.put(
            "/settings",
            json={"enable_read_only_mode": False, "enable_new_episode_button": False},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["enable_read_only_mode"] is False


# ---------------------------------------------------------------------------
# Write mode: guard off when explicitly disabled
# ---------------------------------------------------------------------------

class TestWriteModeEnabled:
    def test_post_episode_succeeds_when_write_enabled(self, write_enabled_client, regular_user):
        headers = auth_headers(write_enabled_client, regular_user.username)
        resp = write_enabled_client.post(
            "/episodes",
            json=make_episode_payload(),
            headers=headers,
        )
        assert resp.status_code == 201

    def test_no_db_record_allows_writes(self, client, regular_user):
        """When no SyncState record exists, guard defaults to write-enabled."""
        headers = auth_headers(client, regular_user.username)
        resp = client.post(
            "/episodes",
            json=make_episode_payload(),
            headers=headers,
        )
        assert resp.status_code == 201
