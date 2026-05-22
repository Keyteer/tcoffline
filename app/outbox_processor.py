import asyncio
import httpx
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.db import SessionLocal
from app import models
from app.hl7_builder import HL7MessageBuilder
from app.settings import settings
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OutboxProcessor:
    """
    Processes outbox events and sends HL7 messages to central server.
    Session-safe: OBR.24 username is derived from the event's author_user_id,
    which is set at event creation time from the JWT session user.
    """

    def __init__(self, central_url: str):
        self.central_url = central_url
        self.hl7_builder = HL7MessageBuilder()
        self.max_retries = settings.MAX_RETRIES

    def _get_event_author_username(self, event: models.OutboxEvent, db: Session) -> Optional[str]:
        """
        Resolve the HL7 OBR.24 user field from the event's stored author_user_id.
        Prefers user.filtros['user'] if set, falls back to user.username.
        Never queries by last_login — always uses the session user at event creation.
        """
        if not event.author_user_id:
            return None
        user = db.query(models.User).filter(models.User.id == event.author_user_id).first()
        if not user:
            return None
        if user.filtros:
            try:
                filtros_dict = dict(x.split("=") for x in user.filtros.split("&") if "=" in x)
                user_field = filtros_dict.get("user")
                if user_field:
                    return user_field
            except Exception:
                pass
        return user.username

    def extract_message_type(self, hl7_message: str) -> str:
        try:
            segments = hl7_message.split('\r')
            for segment in segments:
                segment = segment.strip()
                if segment.startswith('MSH'):
                    fields = segment.split('|')
                    if len(fields) >= 9:
                        return fields[8]
            return "UNKNOWN"
        except Exception as e:
            logger.error(f"Error extracting message type: {e}")
            return "UNKNOWN"

    def extract_pid_from_response(self, response_data: Optional[dict]) -> Optional[str]:
        if not response_data or not isinstance(response_data, dict):
            return None
        pid = response_data.get("pid")
        if pid:
            logger.info(f"Extracted PID from A28 response: {pid}")
            return str(pid)
        logger.warning("No PID found in A28 response")
        return None

    def extract_enctid_from_response(self, response_data: Optional[dict]) -> Optional[str]:
        if not response_data or not isinstance(response_data, dict):
            return None
        enctid = response_data.get("enctid")
        if enctid:
            logger.info(f"Extracted enctid from A01 response: {enctid}")
            return str(enctid)
        logger.warning("No enctid found in A01 response")
        return None

    async def send_hl7_message(self, message: str, msg_type: str = None) -> tuple[bool, str, Optional[dict]]:
        try:
            if not msg_type:
                msg_type = self.extract_message_type(message)

            api_url = f"{self.central_url}{settings.CENTRAL_HL7_ENDPOINT}"
            auth = (settings.CENTRAL_API_USERNAME, settings.CENTRAL_API_PASSWORD)

            payload = {
                "msg": message,
                "msg_type": msg_type,
                "fecha_envio": datetime.utcnow().isoformat()
            }

            logger.info(f"=== SENDING HL7 MESSAGE ===")
            logger.info(f"URL: {api_url}")
            logger.info(f"Auth: {settings.CENTRAL_API_USERNAME}")
            logger.info(f"Message Type: {msg_type}")
            logger.info(f"Complete JSON Payload:\n{json.dumps(payload, indent=2, ensure_ascii=False)}")
            logger.info("=" * 50)

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(api_url, json=payload, auth=auth)

                logger.info(f"Response status: {response.status_code}")
                logger.info(f"Response body: {response.text[:500]}")

                if response.status_code == 200:
                    if not response.text or response.text.strip() == "":
                        return True, "AA", None
                    try:
                        data = response.json()
                        if "estado" in data:
                            if data.get("estado") == "NOK":
                                logger.error(f"Central returned NOK: {data}")
                                return False, "NOK", data
                            return True, "AA", data
                        if "pid" in data or "enctid" in data:
                            return True, "AA", data
                        ack_code = data.get("ack_code", "AA")
                        if ack_code == "AA":
                            return True, ack_code, data if data else None
                        else:
                            return False, ack_code, f"Message rejected with code {ack_code}"
                    except json.JSONDecodeError:
                        return True, "AA", None
                else:
                    error_msg = f"HTTP {response.status_code}: {response.text}"
                    logger.error(f"Failed to send HL7: {error_msg}")
                    return False, "HTTP_ERROR", error_msg

        except httpx.TimeoutException:
            return False, "TIMEOUT", "Request timeout"
        except httpx.ConnectError:
            return False, "CONNECT_ERROR", "Connection refused"
        except Exception as e:
            return False, "ERROR", f"Unexpected error: {str(e)}"

    def generate_hl7_from_event(self, event: models.OutboxEvent, db: Session) -> Optional[str]:
        """
        Generate HL7 from outbox event. For ORU messages, sending_user is resolved
        from event.author_user_id — the session user at event creation time.
        """
        try:
            if event.event_type == "clinical_note_created":
                note_id = int(event.correlation_id)
                note = db.query(models.ClinicalNote).filter(models.ClinicalNote.id == note_id).first()
                if not note:
                    logger.error(f"Clinical note not found: {note_id}")
                    return None

                episode = db.query(models.Episode).filter(models.Episode.id == note.episode_id).first()
                if not episode:
                    logger.error(f"Episode not found for note: {note_id}")
                    return None

                if episode.mrn.startswith("OFFP") or episode.num_episodio.startswith("OFFE"):
                    logger.warning(f"Skipping ORU for episode {episode.num_episodio} - not yet synced with central")
                    return None

                sending_user = self._get_event_author_username(event, db)

                full_name = episode.paciente if episode.paciente else "Unknown Patient"
                note_text_with_author = note.note_text
                if note.author_nombre:
                    note_text_with_author = f"{note.note_text}\n\n{note.author_nombre}"

                observations = [{
                    "observation_id": "CLINICALNOTE",
                    "observation_text": "Clinical Note",
                    "value": note_text_with_author,
                    "value_type": "TX",
                    "units": "",
                    "datetime": note.created_at
                }]

                message, _ = self.hl7_builder.build_oru_message(
                    patient_id=episode.mrn,
                    rut=episode.run,
                    last_name=full_name,
                    first_name="",
                    birth_date=episode.fecha_nacimiento,
                    sex=episode.sexo,
                    episode_id=episode.num_episodio,
                    observations=observations,
                    location=episode.habitacion,
                    motivo_consulta=episode.motivo_consulta,
                    clinical_unit=episode.ubicacion,
                    control_id=event.id,
                    sending_user=sending_user
                )
                return message

            elif event.event_type == "episode_created":
                num_episodio = event.correlation_id
                episode = db.query(models.Episode).filter(models.Episode.num_episodio == num_episodio).first()
                if not episode:
                    logger.error(f"Episode not found: {num_episodio}")
                    return None

                full_name = episode.paciente if episode.paciente else "Unknown Patient"
                is_new_patient = episode.mrn.startswith("OFFP")
                is_new_episode = episode.num_episodio.startswith("OFFE")

                if is_new_patient and is_new_episode:
                    a28_message, _ = self.hl7_builder.build_a28_message(
                        patient_id=episode.mrn, rut=episode.run,
                        last_name=full_name, first_name="",
                        birth_date=episode.fecha_nacimiento, sex=episode.sexo,
                        control_id=f"{event.id}_A28"
                    )
                    patient_class = "E" if episode.tipo == "Urgencia" else "I" if episode.tipo == "Hospitalizacion" else "O"
                    a01_message, _ = self.hl7_builder.build_a01_message(
                        patient_id=episode.mrn, rut=episode.run,
                        last_name=full_name, first_name="",
                        birth_date=episode.fecha_nacimiento, sex=episode.sexo,
                        episode_id=episode.num_episodio,
                        patient_class=patient_class,
                        location=episode.habitacion, admission_type=episode.tipo,
                        admission_datetime=episode.fecha_atencion,
                        motivo_consulta=episode.motivo_consulta,
                        clinical_unit=episode.ubicacion,
                        control_id=f"{event.id}_A01"
                    )
                    return f"{a28_message}\n{a01_message}"
                else:
                    logger.info(f"Episode {num_episodio} - Already synced from central, no message needed")
                    return None
            else:
                logger.warning(f"Unknown event type: {event.event_type}")
                return None

        except Exception as e:
            logger.error(f"Error generating HL7 for event {event.id}: {e}")
            return None

    async def process_episode_created_event(self, event: models.OutboxEvent, db: Session) -> bool:
        num_episodio = event.correlation_id
        episode = db.query(models.Episode).filter(models.Episode.num_episodio == num_episodio).first()

        if not episode:
            event.status = "failed"
            event.last_error = "Episode not found"
            event.retry_count += 1
            db.commit()
            return False

        full_name = episode.paciente if episode.paciente else "Unknown Patient"
        is_new_patient = episode.mrn.startswith("OFFP")
        is_new_episode = episode.num_episodio.startswith("OFFE")

        if not (is_new_patient and is_new_episode):
            event.status = "sent"
            event.last_error = None
            db.commit()
            return True

        logger.info(f"=== Sequential HL7 Flow for Episode {num_episodio} ===")
        a28_message, _ = self.hl7_builder.build_a28_message(
            patient_id=episode.mrn, rut=episode.run,
            last_name=full_name, first_name="",
            birth_date=episode.fecha_nacimiento, sex=episode.sexo,
            control_id=f"{event.id}_A28"
        )

        success, ack_code, a28_response_data = await self.send_hl7_message(a28_message, "ADT^A28")
        if not success:
            event.retry_count += 1
            event.last_error = f"A28 failed: {str(a28_response_data)}"
            event.status = "failed" if event.retry_count >= self.max_retries else "pending"
            db.commit()
            return False

        real_pid = self.extract_pid_from_response(a28_response_data)
        if not real_pid:
            event.retry_count += 1
            event.last_error = "A28 sent successfully but no PID received from central"
            event.status = "failed" if event.retry_count >= self.max_retries else "pending"
            db.commit()
            return False

        old_mrn = episode.mrn
        episode.mrn = real_pid
        db.commit()
        logger.info(f"Step 1 Complete: PID updated {old_mrn} -> {real_pid}")

        await asyncio.sleep(0.5)

        patient_class = "E" if episode.tipo == "Urgencia" else "I" if episode.tipo == "Hospitalizacion" else "O"
        a01_message, _ = self.hl7_builder.build_a01_message(
            patient_id=real_pid, rut=episode.run,
            last_name=full_name, first_name="",
            birth_date=episode.fecha_nacimiento, sex=episode.sexo,
            episode_id=episode.num_episodio,
            patient_class=patient_class,
            location=episode.habitacion, admission_type=episode.tipo,
            admission_datetime=episode.fecha_atencion,
            motivo_consulta=episode.motivo_consulta,
            clinical_unit=episode.ubicacion,
            control_id=f"{event.id}_A01"
        )

        success, ack_code, a01_response_data = await self.send_hl7_message(a01_message, "ADT^A01")
        if not success:
            event.retry_count += 1
            event.last_error = f"A01 failed (after successful A28): {str(a01_response_data)}"
            event.status = "failed" if event.retry_count >= self.max_retries else "pending"
            db.commit()
            return False

        real_enctid = self.extract_enctid_from_response(a01_response_data)
        if not real_enctid:
            event.retry_count += 1
            event.last_error = "A01 sent but no enctid received from central"
            event.status = "failed" if event.retry_count >= self.max_retries else "pending"
            db.commit()
            return False

        old_num_episodio = episode.num_episodio
        episode.num_episodio = real_enctid
        episode.synced_flag = True
        db.commit()
        logger.info(f"Step 2 Complete: Episode ID {old_num_episodio} -> {real_enctid}")

        event.status = "sent"
        event.last_error = None
        event.hl7_payload = f"{a28_message}\n{a01_message}"
        db.commit()
        return True

    async def process_event(self, event: models.OutboxEvent, db: Session) -> bool:
        logger.info(f"Processing event {event.id} (type: {event.event_type}, attempt: {event.retry_count + 1})")

        if event.event_type == "episode_created":
            return await self.process_episode_created_event(event, db)

        hl7_message = self.generate_hl7_from_event(event, db)

        if not hl7_message:
            event.status = "failed"
            event.last_error = "Failed to generate HL7 message"
            event.retry_count += 1
            db.commit()
            return False

        event.hl7_payload = hl7_message
        db.commit()
        msg_type = self.extract_message_type(hl7_message)
        success, ack_code, response_data = await self.send_hl7_message(hl7_message, msg_type)

        if success:
            event.status = "sent"
            event.last_error = None

            if event.event_type == "clinical_note_created":
                note_id = int(event.correlation_id)
                note = db.query(models.ClinicalNote).filter(models.ClinicalNote.id == note_id).first()
                if note:
                    note.synced_flag = True
                    episode = note.episode
                    if response_data and isinstance(response_data, dict):
                        tc_patient_id = response_data.get("pid")
                        tc_episode_id = response_data.get("enctid")
                        if tc_patient_id and tc_patient_id != episode.mrn:
                            episode.mrn = str(tc_patient_id)
                        if tc_episode_id and tc_episode_id != episode.num_episodio:
                            episode.num_episodio = str(tc_episode_id)
                        if tc_patient_id or tc_episode_id:
                            episode.synced_flag = True
            logger.info(f"Event {event.id} sent successfully")
        else:
            event.retry_count += 1
            event.last_error = str(response_data) if response_data else "Unknown error"
            event.status = "failed" if event.retry_count >= self.max_retries else "pending"
            if event.status == "failed":
                logger.error(f"Event {event.id} failed after {event.retry_count} retries")
            else:
                logger.warning(f"Event {event.id} failed, will retry (attempt {event.retry_count}/{self.max_retries})")

        db.commit()
        return success

    async def process_pending_events(self):
        db = SessionLocal()
        try:
            pending_events = db.query(models.OutboxEvent).filter(
                and_(
                    models.OutboxEvent.status.in_(["pending"]),
                    models.OutboxEvent.retry_count < self.max_retries
                )
            ).order_by(
                models.OutboxEvent.priority.desc(),
                models.OutboxEvent.created_at.asc()
            ).limit(100).all()

            if not pending_events:
                logger.debug("No pending events to process")
                return

            logger.info(f"Processing {len(pending_events)} pending events")
            success_count = 0
            fail_count = 0

            for event in pending_events:
                try:
                    success = await self.process_event(event, db)
                    if success:
                        success_count += 1
                    else:
                        fail_count += 1
                    await asyncio.sleep(0.5)
                except Exception as e:
                    logger.error(f"Error processing event {event.id}: {e}")
                    fail_count += 1

            logger.info(f"Batch complete: {success_count} sent, {fail_count} failed")

            if success_count > 0:
                from app.sync_service import SyncStateManager
                SyncStateManager.update_last_upstream_sync(db)

        except Exception as e:
            logger.error(f"Error in process_pending_events: {e}")
        finally:
            db.close()

    async def retry_failed_events(self):
        db = SessionLocal()
        try:
            failed_events = db.query(models.OutboxEvent).filter(
                and_(
                    models.OutboxEvent.status == "failed",
                    models.OutboxEvent.retry_count < self.max_retries
                )
            ).all()

            if failed_events:
                logger.info(f"Resetting {len(failed_events)} failed events for retry")
                for event in failed_events:
                    event.status = "pending"
                db.commit()
        except Exception as e:
            logger.error(f"Error retrying failed events: {e}")
        finally:
            db.close()
