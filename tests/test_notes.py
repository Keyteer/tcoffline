"""Tests for /episodes/{id}/notes endpoints."""
from tests.conftest import make_episode_payload
from app import models


def _create_episode(client, headers, num="NOTE-EP-1"):
    resp = client.post("/episodes", json=make_episode_payload(num_episodio=num), headers=headers)
    assert resp.status_code == 201
    return resp.json()["id"]


class TestCreateNote:
    def test_create_note(self, client, user_headers, db):
        ep_id = _create_episode(client, user_headers)

        resp = client.post(f"/episodes/{ep_id}/notes", json={
            "note_text": "Patient stable. Vitals normal.",
        }, headers=user_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["note_text"] == "Patient stable. Vitals normal."
        assert body["episode_id"] == ep_id
        assert body["synced_flag"] is False

        # Verify outbox event
        outbox = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.event_type == "clinical_note_created",
        ).first()
        assert outbox is not None
        assert outbox.status == "pending"

    def test_create_note_episode_not_found(self, client, user_headers):
        resp = client.post("/episodes/99999/notes", json={
            "note_text": "Ghost note",
        }, headers=user_headers)
        assert resp.status_code == 404

    def test_create_note_unauthorized(self, client):
        resp = client.post("/episodes/1/notes", json={"note_text": "nope"})
        assert resp.status_code == 401


class TestListNotes:
    def test_list_notes(self, client, user_headers):
        ep_id = _create_episode(client, user_headers, num="NOTE-LIST-1")
        client.post(f"/episodes/{ep_id}/notes", json={"note_text": "Note A"}, headers=user_headers)
        client.post(f"/episodes/{ep_id}/notes", json={"note_text": "Note B"}, headers=user_headers)

        resp = client.get(f"/episodes/{ep_id}/notes", headers=user_headers)
        assert resp.status_code == 200
        notes = resp.json()
        assert len(notes) == 2
        # Notes come with author info
        assert "author_username" in notes[0]
        assert "author_nombre" in notes[0]

    def test_list_notes_episode_not_found(self, client, user_headers):
        resp = client.get("/episodes/99999/notes", headers=user_headers)
        assert resp.status_code == 404

    def test_list_notes_empty(self, client, user_headers):
        ep_id = _create_episode(client, user_headers, num="NOTE-EMPTY-1")
        resp = client.get(f"/episodes/{ep_id}/notes", headers=user_headers)
        assert resp.status_code == 200
        assert resp.json() == []


class TestGetNote:
    def test_get_note_by_id(self, client, user_headers):
        ep_id = _create_episode(client, user_headers, num="NOTE-GET-1")
        create = client.post(f"/episodes/{ep_id}/notes", json={
            "note_text": "Specific note",
        }, headers=user_headers)
        note_id = create.json()["id"]

        resp = client.get(f"/episodes/{ep_id}/notes/{note_id}", headers=user_headers)
        assert resp.status_code == 200
        assert resp.json()["note_text"] == "Specific note"

    def test_get_note_not_found(self, client, user_headers):
        ep_id = _create_episode(client, user_headers, num="NOTE-GET-404")
        resp = client.get(f"/episodes/{ep_id}/notes/99999", headers=user_headers)
        assert resp.status_code == 404
