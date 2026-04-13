"""Tests for general endpoints: /health, /discovery, /sync/status, /settings."""
from app import models


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert body["service"] == "trakcare_offline_local"

    def test_health_with_language_header(self, client):
        resp = client.get("/health", headers={"Accept-Language": "en"})
        assert resp.status_code == 200
        assert resp.json()["language"] == "en"


class TestDiscovery:
    def test_discovery(self, client):
        resp = client.get("/discovery")
        assert resp.status_code == 200
        body = resp.json()
        assert body["service"] == "trakcare_offline"
        assert "version" in body
        assert "hostname" in body
        assert "ip" in body
        assert "port" in body
        assert "auth_methods" in body
        assert "jwt" in body["auth_methods"]


class TestRoot:
    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        body = resp.json()
        assert "version" in body
        assert body["docs"] == "/docs"


class TestSyncStatus:
    def test_sync_status(self, client, user_headers):
        resp = client.get("/sync/status", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "pending_events" in body
        assert "failed_events" in body
        assert "total_outbox_events" in body

    def test_sync_status_unauthorized(self, client):
        resp = client.get("/sync/status")
        assert resp.status_code == 401


class TestSystemSettings:
    def test_get_settings(self, client, user_headers):
        resp = client.get("/settings", headers=user_headers)
        assert resp.status_code == 200
        assert "enable_read_only_mode" in resp.json()

    def test_update_settings_as_admin(self, client, admin_headers):
        resp = client.put("/settings", json={
            "enable_read_only_mode": False,
        }, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["enable_read_only_mode"] is False

        # Verify it persists
        resp2 = client.get("/settings", headers=admin_headers)
        assert resp2.json()["enable_read_only_mode"] is False

    def test_update_settings_as_regular_forbidden(self, client, user_headers):
        resp = client.put("/settings", json={
            "enable_read_only_mode": False,
        }, headers=user_headers)
        assert resp.status_code == 403
