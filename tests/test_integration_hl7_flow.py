"""
Integration tests for the HL7 data flow.

These tests use a real PostgreSQL database (tcoffline_test) but mock
the HTTP calls to the TrakCare central server.  They exercise the full
OutboxProcessor cycle end-to-end:

  Episode/Note created in DB
    → OutboxEvent written
    → OutboxProcessor.process_event() called
    → HL7 message built (real builder, no mock)
    → HTTP POST to TC (MOCKED — no network needed)
    → DB updated with central IDs / synced_flag
    → Assertions on final DB state

Coverage:
  - A28 → PID → A01 → enctid → episode synced           (new patient flow)
  - A28 fails / no PID in response → retry logic
  - Retry count exhaustion → event.status = "failed"
  - A01 fails after successful A28 → retry logic
  - episode_updated → A08 sent for synced episodes
  - episode_updated → skipped (not yet synced), event marked sent
  - clinical_note_created → ORU sent, note.synced_flag = True
  - clinical_note_created → skipped (unsynced episode), event failed
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import patch, AsyncMock

from app import models
from app.outbox_processor import OutboxProcessor
from app.settings import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_episode(
    db,
    *,
    mrn: str,
    num_episodio: str,
    synced: bool = False,
    tipo: str = "Ambulatorio",
) -> models.Episode:
    episode = models.Episode(
        mrn=mrn,
        num_episodio=num_episodio,
        paciente="Rodriguez, Carmen",
        run="20602702-9",
        fecha_nacimiento=datetime(1975, 12, 1),
        sexo="F",
        tipo=tipo,
        fecha_atencion=datetime(2026, 4, 21, 9, 0, 0),
        hospital="Hospital Test",
        habitacion="101",
        cama="A",
        ubicacion="UCI",
        estado="Activo",
        profesional="Dr. Test",
        motivo_consulta="Consulta general",
        data_json={},
        synced_flag=synced,
    )
    db.add(episode)
    db.commit()
    db.refresh(episode)
    return episode


def _make_event(
    db,
    *,
    event_type: str,
    correlation_id: str,
    retry_count: int = 0,
) -> models.OutboxEvent:
    event = models.OutboxEvent(
        event_type=event_type,
        correlation_id=correlation_id,
        status="pending",
        retry_count=retry_count,
        priority=2,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def _make_user_with_filtros(db, admin_user: models.User) -> models.User:
    """Set filtros and last_login on admin_user (needed by build_obr_segment)."""
    admin_user.filtros = "user=doctest"
    admin_user.last_login = datetime(2026, 4, 21, 12, 0, 0)
    db.commit()
    db.refresh(admin_user)
    return admin_user


def _new_processor() -> OutboxProcessor:
    return OutboxProcessor(settings.CENTRAL_URL)


# ---------------------------------------------------------------------------
# New patient — A28 → A01 sequential flow
# ---------------------------------------------------------------------------

class TestNewPatientFlow:
    async def test_a28_a01_full_success(self, db):
        """New patient (OFFP + OFFE) → A28 → real PID → A01 → real enctid → synced."""
        episode = _make_episode(db, mrn="OFFP-001", num_episodio="OFFE-001")
        event = _make_event(db, event_type="episode_created", correlation_id="OFFE-001")

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            mock_send.side_effect = [
                (True, "AA", {"pid": "TC-PID-001"}),      # A28 response
                (True, "AA", {"enctid": "TC-ENC-001"}),   # A01 response
            ]
            result = await processor.process_event(event, db)

        assert result is True

        db.refresh(episode)
        assert episode.mrn == "TC-PID-001"
        assert episode.num_episodio == "TC-ENC-001"
        assert episode.synced_flag is True

        db.refresh(event)
        assert event.status == "sent"
        assert event.retry_count == 0

        # A28 was called first, A01 second
        assert mock_send.call_count == 2
        assert mock_send.call_args_list[0].args[1] == "ADT^A28"
        assert mock_send.call_args_list[1].args[1] == "ADT^A01"

        # A28 message contains original local MRN
        assert "OFFP-001" in mock_send.call_args_list[0].args[0]
        # A01 message contains the real PID returned by A28
        assert "TC-PID-001" in mock_send.call_args_list[1].args[0]

    async def test_a28_http_failure_increments_retry(self, db):
        """A28 HTTP error → event stays pending, retry_count incremented."""
        episode = _make_episode(db, mrn="OFFP-002", num_episodio="OFFE-002")
        event = _make_event(db, event_type="episode_created", correlation_id="OFFE-002")

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            mock_send.return_value = (False, "HTTP_ERROR", "Service unavailable")
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "pending"
        assert event.retry_count == 1

        # Episode MRN unchanged
        db.refresh(episode)
        assert episode.mrn == "OFFP-002"
        assert episode.synced_flag is False

    async def test_a28_success_but_no_pid_retries(self, db):
        """A28 returns 200 but no pid in response body → retry."""
        episode = _make_episode(db, mrn="OFFP-003", num_episodio="OFFE-003")
        event = _make_event(db, event_type="episode_created", correlation_id="OFFE-003")

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            mock_send.return_value = (True, "AA", {})  # empty body — no pid
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "pending"
        assert event.retry_count == 1

        db.refresh(episode)
        assert episode.mrn == "OFFP-003"   # unchanged

    async def test_retry_exhaustion_marks_failed(self, db):
        """A28 fails when retry_count is already at MAX_RETRIES - 1 → status = failed."""
        episode = _make_episode(db, mrn="OFFP-004", num_episodio="OFFE-004")
        event = _make_event(
            db,
            event_type="episode_created",
            correlation_id="OFFE-004",
            retry_count=settings.MAX_RETRIES - 1,
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            mock_send.return_value = (False, "HTTP_ERROR", "Timeout")
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "failed"
        assert event.retry_count == settings.MAX_RETRIES

    async def test_a01_failure_after_a28_success_retries(self, db):
        """A28 succeeds and PID is persisted, but A01 fails → retry."""
        episode = _make_episode(db, mrn="OFFP-005", num_episodio="OFFE-005")
        event = _make_event(db, event_type="episode_created", correlation_id="OFFE-005")

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            mock_send.side_effect = [
                (True, "AA", {"pid": "TC-PID-005"}),    # A28 OK
                (False, "HTTP_ERROR", "Timeout"),        # A01 fails
            ]
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(episode)
        # MRN WAS updated by the A28 step — it's committed before A01 is attempted
        assert episode.mrn == "TC-PID-005"
        assert episode.synced_flag is False

        db.refresh(event)
        assert event.status == "pending"
        assert event.retry_count == 1

    async def test_already_synced_episode_created_skipped(self, db):
        """episode_created for non-OFFP/OFFE episode → skipped immediately, marked sent."""
        episode = _make_episode(
            db, mrn="EXISTING-MRN", num_episodio="EXISTING-ENC", synced=True
        )
        event = _make_event(
            db, event_type="episode_created", correlation_id="EXISTING-ENC"
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send, \
             patch("asyncio.sleep", new_callable=AsyncMock):
            result = await processor.process_event(event, db)

        assert result is True

        db.refresh(event)
        assert event.status == "sent"

        # No HL7 message should have been sent
        mock_send.assert_not_called()


# ---------------------------------------------------------------------------
# Episode updated — A08 flow
# ---------------------------------------------------------------------------

class TestEpisodeUpdatedFlow:
    async def test_a08_sent_for_synced_episode(self, db):
        """episode_updated for a synced episode → A08 sent, event marked sent."""
        episode = _make_episode(
            db, mrn="TC-MRN-A08", num_episodio="TC-ENC-A08", synced=True
        )
        event = _make_event(
            db, event_type="episode_updated", correlation_id="TC-ENC-A08"
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (True, "AA", None)
            result = await processor.process_event(event, db)

        assert result is True

        db.refresh(event)
        assert event.status == "sent"

        mock_send.assert_called_once()
        assert mock_send.call_args.args[1] == "ADT^A08"
        # A08 message must contain the episode's current MRN and episode ID
        a08_msg = mock_send.call_args.args[0]
        assert "TC-MRN-A08" in a08_msg
        assert "TC-ENC-A08" in a08_msg

    async def test_a08_skipped_for_unsynced_episode(self, db):
        """episode_updated for OFFP/OFFE episode → skip, mark event sent without sending A08."""
        episode = _make_episode(
            db, mrn="OFFP-A08", num_episodio="OFFE-A08", synced=False
        )
        event = _make_event(
            db, event_type="episode_updated", correlation_id="OFFE-A08"
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            result = await processor.process_event(event, db)

        assert result is True

        db.refresh(event)
        assert event.status == "sent"
        mock_send.assert_not_called()

    async def test_a08_failure_increments_retry(self, db):
        """A08 HTTP error → event stays pending, retry_count incremented."""
        episode = _make_episode(
            db, mrn="TC-MRN-RETRY", num_episodio="TC-ENC-RETRY", synced=True
        )
        event = _make_event(
            db, event_type="episode_updated", correlation_id="TC-ENC-RETRY"
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (False, "HTTP_ERROR", "Service unavailable")
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "pending"
        assert event.retry_count == 1

    async def test_a08_emergency_patient_class(self, db):
        """episode_updated for Urgencia type → A08 message has patient class E."""
        episode = _make_episode(
            db,
            mrn="TC-MRN-ERG",
            num_episodio="TC-ENC-ERG",
            synced=True,
            tipo="Urgencia",
        )
        event = _make_event(
            db, event_type="episode_updated", correlation_id="TC-ENC-ERG"
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (True, "AA", None)
            await processor.process_event(event, db)

        a08_msg = mock_send.call_args.args[0]
        # PV1.2 = patient class — should be "E" for Urgencia
        # The PV1 segment starts PV1||E|...
        assert "PV1||E|" in a08_msg


# ---------------------------------------------------------------------------
# Clinical note — ORU^R01 flow
# ---------------------------------------------------------------------------

class TestClinicalNoteFlow:
    async def test_oru_sent_for_synced_episode(self, db, admin_user):
        """clinical_note_created on synced episode → ORU sent, note.synced_flag = True."""
        _make_user_with_filtros(db, admin_user)

        episode = _make_episode(
            db, mrn="TC-MRN-ORU", num_episodio="TC-ENC-ORU", synced=True
        )
        note = models.ClinicalNote(
            episode_id=episode.id,
            author_user_id=admin_user.id,
            author_nombre=admin_user.nombre,
            note_text="Paciente estable, sin cambios relevantes.",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        event = _make_event(
            db, event_type="clinical_note_created", correlation_id=str(note.id)
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (
                True,
                "AA",
                {"estado": "ok", "pid": "TC-MRN-ORU", "enctid": "TC-ENC-ORU"},
            )
            result = await processor.process_event(event, db)

        assert result is True

        db.refresh(event)
        assert event.status == "sent"

        db.refresh(note)
        assert note.synced_flag is True

        mock_send.assert_called_once()
        oru_msg = mock_send.call_args.args[0]
        # ORU message must reference the episode ID and contain the note text
        assert "TC-ENC-ORU" in oru_msg
        assert "Paciente estable" in oru_msg

    async def test_oru_skipped_for_unsynced_episode(self, db, admin_user):
        """clinical_note_created when episode is OFFP/OFFE → no ORU, event failed."""
        _make_user_with_filtros(db, admin_user)

        episode = _make_episode(
            db, mrn="OFFP-ORU", num_episodio="OFFE-ORU", synced=False
        )
        note = models.ClinicalNote(
            episode_id=episode.id,
            author_user_id=admin_user.id,
            author_nombre=admin_user.nombre,
            note_text="Nota que no debe enviarse.",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        event = _make_event(
            db, event_type="clinical_note_created", correlation_id=str(note.id)
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "failed"
        mock_send.assert_not_called()

        db.refresh(note)
        assert note.synced_flag is False

    async def test_oru_failure_increments_retry(self, db, admin_user):
        """ORU HTTP error → event stays pending, retry_count incremented."""
        _make_user_with_filtros(db, admin_user)

        episode = _make_episode(
            db, mrn="TC-MRN-ORU2", num_episodio="TC-ENC-ORU2", synced=True
        )
        note = models.ClinicalNote(
            episode_id=episode.id,
            author_user_id=admin_user.id,
            author_nombre=admin_user.nombre,
            note_text="Otra nota de prueba.",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        event = _make_event(
            db, event_type="clinical_note_created", correlation_id=str(note.id)
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (False, "HTTP_ERROR", "Timeout")
            result = await processor.process_event(event, db)

        assert result is False

        db.refresh(event)
        assert event.status == "pending"
        assert event.retry_count == 1

        db.refresh(note)
        assert note.synced_flag is False

    async def test_oru_hl7_message_structure(self, db, admin_user):
        """Verify the built ORU message contains required HL7 segments."""
        _make_user_with_filtros(db, admin_user)

        episode = _make_episode(
            db, mrn="TC-MRN-ORU3", num_episodio="TC-ENC-ORU3", synced=True
        )
        note = models.ClinicalNote(
            episode_id=episode.id,
            author_user_id=admin_user.id,
            author_nombre="Dr. Ejemplo",
            note_text="Exploración física normal.",
        )
        db.add(note)
        db.commit()
        db.refresh(note)

        event = _make_event(
            db, event_type="clinical_note_created", correlation_id=str(note.id)
        )

        processor = _new_processor()

        with patch.object(processor, "send_hl7_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = (True, "AA", {"estado": "ok"})
            await processor.process_event(event, db)

        oru_msg = mock_send.call_args.args[0]

        # Must have all required HL7 segments
        assert "MSH|" in oru_msg
        assert "PID|" in oru_msg
        assert "PV1|" in oru_msg
        assert "OBR|" in oru_msg
        assert "OBX|" in oru_msg

        # MSH must declare ORU^R01
        assert "ORU^R01" in oru_msg

        # PID must contain the episode MRN
        assert "TC-MRN-ORU3" in oru_msg

        # OBR must contain the parsed user value (builder extracts value from "user=doctest")
        assert "doctest" in oru_msg

        # Note text must appear in the message
        assert "Exploraci" in oru_msg  # prefix handles encoding variance
