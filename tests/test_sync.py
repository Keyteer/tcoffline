"""Tests for /sync endpoints."""
from unittest.mock import patch, AsyncMock


class TestConnectionStatus:
    def test_connection_status(self, client, user_headers):
        resp = client.get("/sync/connection-status", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "is_online" in body
        assert "last_check" in body

    def test_connection_status_unauthorized(self, client):
        resp = client.get("/sync/connection-status")
        assert resp.status_code == 401


class TestSyncStats:
    def test_sync_stats(self, client, user_headers):
        resp = client.get("/sync/stats", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "pending_events" in body
        assert "failed_events" in body
        assert "connection" in body


class TestTriggerSync:
    def test_trigger_sync(self, client, user_headers):
        with patch("app.routers.sync.OutboxProcessor") as mock_proc:
            mock_proc.return_value.process_pending_events = AsyncMock()
            resp = client.post("/sync/trigger", headers=user_headers)
            assert resp.status_code == 200
            assert "pending_events" in resp.json()

    def test_trigger_sync_unauthorized(self, client):
        resp = client.post("/sync/trigger")
        assert resp.status_code == 401


class TestRetryFailed:
    def test_retry_failed(self, client, user_headers):
        with patch("app.routers.sync.OutboxProcessor") as mock_proc:
            mock_proc.return_value.retry_failed_events = AsyncMock()
            mock_proc.return_value.process_pending_events = AsyncMock()
            resp = client.post("/sync/retry-failed", headers=user_headers)
            assert resp.status_code == 200
            assert "failed_events" in resp.json()


class TestSyncFromCentral:
    def test_sync_from_central(self, client, user_headers):
        with patch("app.routers.sync.sync_from_central", new_callable=AsyncMock) as mock_sync:
            mock_sync.return_value = None
            resp = client.post("/sync/from-central", headers=user_headers)
            assert resp.status_code == 200
            body = resp.json()
            assert "message" in body
            assert "episodes" in body
