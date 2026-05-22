"""Tests for general endpoints: /health, /sync/status, /settings."""
from unittest.mock import patch, MagicMock


class TestHealth:
    def test_health_check(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert "service" in body


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
            "enable_new_episode_button": False,
        }, headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["enable_read_only_mode"] is False

        resp2 = client.get("/settings", headers=admin_headers)
        assert resp2.json()["enable_read_only_mode"] is False

    def test_update_settings_as_regular_forbidden(self, client, user_headers):
        resp = client.put("/settings", json={
            "enable_read_only_mode": False,
            "enable_new_episode_button": False,
        }, headers=user_headers)
        assert resp.status_code == 403


class TestCentralHealth:
    """`/health/central` proxies an HTTP HEAD to the central server. Requires auth."""

    def _mock_httpx_response(self, status_code: int):
        response = MagicMock()
        response.status_code = status_code

        client_instance = MagicMock()
        client_instance.head.return_value = response
        client_instance.__enter__.return_value = client_instance
        client_instance.__exit__.return_value = None

        return client_instance

    def test_central_health_requires_auth(self, client):
        resp = client.get("/health/central")
        assert resp.status_code == 401

    def test_central_online(self, client, user_headers):
        with patch("app.routers.general.httpx.Client") as mock_cls:
            mock_cls.return_value = self._mock_httpx_response(200)
            resp = client.get("/health/central", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "online"
        assert "central_url" in body

    def test_central_offline_on_5xx(self, client, user_headers):
        with patch("app.routers.general.httpx.Client") as mock_cls:
            mock_cls.return_value = self._mock_httpx_response(503)
            resp = client.get("/health/central", headers=user_headers)
        assert resp.json()["status"] == "offline"

    def test_central_offline_on_exception(self, client, user_headers):
        with patch("app.routers.general.httpx.Client", side_effect=RuntimeError("boom")):
            resp = client.get("/health/central", headers=user_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "offline"
