"""Tests for /sync endpoints."""
from unittest.mock import patch, AsyncMock

from app import models


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


# ---------------------------------------------------------------------------
# DB-state assertions: verify trigger/retry endpoints actually see the right
# rows in the outbox table (not just that the response shape is correct).
# ---------------------------------------------------------------------------

def _seed_event(db, *, status: str, event_type: str = "episode_created",
                correlation_id: str = "X", retry_count: int = 0) -> models.OutboxEvent:
    event = models.OutboxEvent(
        event_type=event_type,
        correlation_id=correlation_id,
        status=status,
        retry_count=retry_count,
        priority=2,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


class TestSyncTriggerDBState:
    def test_trigger_reports_actual_pending_count(self, client, user_headers, db):
        _seed_event(db, status="pending", correlation_id="P1")
        _seed_event(db, status="pending", correlation_id="P2")
        _seed_event(db, status="failed",  correlation_id="F1")
        _seed_event(db, status="sent",    correlation_id="S1")

        with patch("app.routers.sync.OutboxProcessor") as mock_proc:
            mock_proc.return_value.process_pending_events = AsyncMock()
            resp = client.post("/sync/trigger", headers=user_headers)

        assert resp.status_code == 200
        assert resp.json()["pending_events"] == 2

    def test_trigger_with_empty_outbox(self, client, user_headers):
        with patch("app.routers.sync.OutboxProcessor") as mock_proc:
            mock_proc.return_value.process_pending_events = AsyncMock()
            resp = client.post("/sync/trigger", headers=user_headers)
        assert resp.json()["pending_events"] == 0


class TestRetryFailedDBState:
    def test_retry_reports_actual_failed_count(self, client, user_headers, db):
        _seed_event(db, status="failed", correlation_id="F1")
        _seed_event(db, status="failed", correlation_id="F2")
        _seed_event(db, status="failed", correlation_id="F3")
        _seed_event(db, status="pending", correlation_id="P1")

        with patch("app.routers.sync.OutboxProcessor") as mock_proc:
            mock_proc.return_value.retry_failed_events = AsyncMock()
            mock_proc.return_value.process_pending_events = AsyncMock()
            resp = client.post("/sync/retry-failed", headers=user_headers)

        assert resp.status_code == 200
        assert resp.json()["failed_events"] == 3


class TestSyncStatsDBState:
    def test_stats_reflect_outbox_table(self, client, user_headers, db):
        _seed_event(db, status="pending", correlation_id="P1")
        _seed_event(db, status="pending", correlation_id="P2")
        _seed_event(db, status="failed",  correlation_id="F1")
        _seed_event(db, status="sent",    correlation_id="S1")

        resp = client.get("/sync/stats", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["pending_events"] == 2
        assert body["failed_events"] == 1


class TestSyncStatusDBState:
    def test_status_reflects_outbox_table(self, client, user_headers, db):
        _seed_event(db, status="pending", correlation_id="P1")
        _seed_event(db, status="failed",  correlation_id="F1")
        _seed_event(db, status="sent",    correlation_id="S1")

        resp = client.get("/sync/status", headers=user_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["pending_events"] == 1
        assert body["failed_events"] == 1
        assert body["total_outbox_events"] == 3
