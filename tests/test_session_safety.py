"""
Tests for session-safe HL7 OBR.24 author resolution.

OutboxEvent.author_user_id is captured at event-creation time so that
generate_hl7_from_event() always reports the professional who performed the
action — even if another user logs in before the outbox is processed.

Key regression to prevent:
    User A creates note  →  User B logs in  →  outbox processed
    OBR.24 must still be A's username, not B's.
"""
import pytest
from datetime import datetime

from app import models
from app.outbox_processor import OutboxProcessor
from app.settings import settings
from tests.conftest import make_episode_payload, auth_headers, DEFAULT_PASSWORD


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(db, *, username: str, filtros: str = None) -> models.User:
    user = models.User(
        username=username,
        hashed_password=models.User.hash_password(DEFAULT_PASSWORD),
        role="user",
        is_admin=False,
        active=True,
        nombre=f"Dr. {username.capitalize()}",
        filtros=filtros,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_synced_episode(db, *, mrn: str, num_episodio: str) -> models.Episode:
    ep = models.Episode(
        mrn=mrn,
        num_episodio=num_episodio,
        paciente="Fernández, Ana",
        run="12345678-9",
        fecha_nacimiento=datetime(1980, 5, 15),
        sexo="F",
        tipo="Ambulatorio",
        fecha_atencion=datetime(2026, 1, 10, 8, 0, 0),
        hospital="Hospital Test",
        habitacion="202",
        cama="B",
        ubicacion="MED",
        estado="Activo",
        profesional="Dr. Test",
        motivo_consulta="Control",
        data_json="{}",
        synced_flag=True,
    )
    db.add(ep)
    db.commit()
    db.refresh(ep)
    return ep


def _make_note(db, *, episode_id: int, author_user_id: int) -> models.ClinicalNote:
    note = models.ClinicalNote(
        episode_id=episode_id,
        author_user_id=author_user_id,
        author_nombre="Dr. Author",
        note_text="Patient stable.",
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def _make_outbox_event(
    db, *, event_type: str, correlation_id: str, author_user_id: int = None
) -> models.OutboxEvent:
    event = models.OutboxEvent(
        event_type=event_type,
        correlation_id=correlation_id,
        status="pending",
        priority=3,
        author_user_id=author_user_id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _processor() -> OutboxProcessor:
    return OutboxProcessor(settings.CENTRAL_URL)


def _get_obr_segment(hl7_message: str) -> str:
    """Return the first OBR segment from a CR-delimited HL7 message."""
    for segment in hl7_message.split("\r"):
        if segment.startswith("OBR|"):
            return segment
    return ""


# ---------------------------------------------------------------------------
# Unit tests: _get_event_author_username
# ---------------------------------------------------------------------------

class TestGetEventAuthorUsername:
    def test_returns_username_from_filtros(self, db):
        user = _make_user(db, username="doctorA", filtros="user=doctorA&token=abc")
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=user.id,
        )
        assert _processor()._get_event_author_username(event, db) == "doctorA"

    def test_filtros_value_containing_equals_is_safe(self, db):
        """maxsplit=1 ensures values with '=' do not break parsing."""
        user = _make_user(db, username="userB", filtros="user=userB&data=x=y")
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=user.id,
        )
        assert _processor()._get_event_author_username(event, db) == "userB"

    def test_returns_none_for_legacy_event_without_author(self, db):
        """Legacy event (author_user_id=None) returns None."""
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=None,
        )
        assert _processor()._get_event_author_username(event, db) is None

    def test_returns_none_when_user_not_found(self, db):
        """author_user_id points to a non-existent user (e.g. user deleted after event created).
        FK constraint prevents persisting such a value, so we set it on the
        Python object only — enough to exercise the lookup-returns-None branch.
        """
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=None,
        )
        # Simulate a stale/missing FK without committing (bypasses DB constraint)
        event.author_user_id = 99999
        assert _processor()._get_event_author_username(event, db) is None

    def test_falls_back_to_username_when_filtros_is_none(self, db):
        user = _make_user(db, username="nofilters", filtros=None)
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=user.id,
        )
        assert _processor()._get_event_author_username(event, db) == "nofilters"

    def test_falls_back_to_username_when_filtros_has_no_user_key(self, db):
        user = _make_user(db, username="nokey", filtros="token=abc&role=doctor")
        event = _make_outbox_event(
            db, event_type="clinical_note_created", correlation_id="1",
            author_user_id=user.id,
        )
        assert _processor()._get_event_author_username(event, db) == "nokey"


# ---------------------------------------------------------------------------
# Integration: session safety in generate_hl7_from_event
# ---------------------------------------------------------------------------

class TestSessionSafetyHL7:
    def test_obr24_uses_author_not_last_login_user(self, db):
        """
        Regression guard: user A creates note → user B logs in → outbox processed.
        OBR.24 must contain A's username, not B's.
        """
        user_a = _make_user(db, username="doctorA", filtros="user=doctorA")
        user_b = _make_user(db, username="doctorB", filtros="user=doctorB")

        episode = _make_synced_episode(db, mrn="P-SS-001", num_episodio="EP-SS-001")
        note = _make_note(db, episode_id=episode.id, author_user_id=user_a.id)
        event = _make_outbox_event(
            db,
            event_type="clinical_note_created",
            correlation_id=str(note.id),
            author_user_id=user_a.id,
        )

        # Simulate user B logging in after the event was already created
        user_b.last_login = datetime.utcnow()
        db.commit()

        hl7 = _processor().generate_hl7_from_event(event, db)

        assert hl7 is not None, "generate_hl7_from_event returned None"
        obr = _get_obr_segment(hl7)
        assert obr != "", "No OBR segment found in HL7 message"
        assert obr.endswith("doctorA"), f"OBR.24 expected 'doctorA', got: {obr.split('|')[-1]!r}"
        assert "doctorB" not in obr, "OBR segment must not contain user B's username"

    def test_obr24_empty_for_legacy_event(self, db):
        """
        Legacy outbox event (author_user_id=None) still produces a valid HL7
        message; OBR.24 is empty (no username leaked from other users).
        """
        user = _make_user(db, username="anyuser", filtros="user=anyuser")

        # Simulate another user logged in (last_login set)
        user.last_login = datetime.utcnow()
        db.commit()

        episode = _make_synced_episode(db, mrn="P-SS-002", num_episodio="EP-SS-002")
        note = _make_note(db, episode_id=episode.id, author_user_id=user.id)

        # Event has no author_user_id (created before migration)
        event = _make_outbox_event(
            db,
            event_type="clinical_note_created",
            correlation_id=str(note.id),
            author_user_id=None,
        )

        hl7 = _processor().generate_hl7_from_event(event, db)

        assert hl7 is not None
        obr = _get_obr_segment(hl7)
        assert obr != ""
        # OBR.24 is empty — last field is "" (segment ends with trailing pipe
        # or the last value is empty)
        last_field = obr.split("|")[-1]
        assert last_field == "", f"OBR.24 should be empty for legacy event, got {last_field!r}"
        assert "anyuser" not in obr


# ---------------------------------------------------------------------------
# Router: author_user_id captured at note-creation time
# ---------------------------------------------------------------------------

class TestAuthorCapturedOnCreate:
    def test_outbox_event_stores_author_user_id(self, client, db):
        """
        When a clinical note is created via the API, the resulting OutboxEvent
        must have author_user_id matching the authenticated user.
        """
        user = _make_user(db, username="noteauthor", filtros="user=noteauthor")
        headers = auth_headers(client, user.username)

        # Create episode first
        ep_resp = client.post(
            "/episodes",
            json=make_episode_payload(num_episodio="EP-AUTH-001", mrn="MRN-AUTH-001"),
            headers=headers,
        )
        assert ep_resp.status_code == 201
        ep_id = ep_resp.json()["id"]

        # Create note as this user
        note_resp = client.post(
            f"/episodes/{ep_id}/notes",
            json={"note_text": "Session safety check."},
            headers=headers,
        )
        assert note_resp.status_code == 201

        event = (
            db.query(models.OutboxEvent)
            .filter(models.OutboxEvent.event_type == "clinical_note_created")
            .first()
        )
        assert event is not None
        assert event.author_user_id == user.id, (
            f"Expected author_user_id={user.id}, got {event.author_user_id}"
        )
