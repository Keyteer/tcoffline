import asyncio
import httpx
from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session
from app.settings import settings
from app.db import SessionLocal
from app import models
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CentralHealthChecker:
    """Service to check central server connectivity."""

    def __init__(self, central_url: str, check_interval: int = 8):
        self.central_url = central_url
        self.check_interval = check_interval
        self.is_connected = False
        self.last_check = None
        self.consecutive_failures = 0
        self.consecutive_successes = 0

    async def check_health(self) -> bool:
        """Check if central server is reachable using a simple health check."""
        try:
            api_url = f"{self.central_url}{settings.CENTRAL_API_ENDPOINT}"
            auth = (settings.CENTRAL_API_USERNAME, settings.CENTRAL_API_PASSWORD)

            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(api_url, auth=auth)
                if response.status_code == 200:
                    self.consecutive_failures = 0
                    self.consecutive_successes += 1
                    if self.consecutive_successes >= 2:
                        self.is_connected = True
                    self.last_check = datetime.utcnow()
                    return True
        except Exception as e:
            logger.warning(f"Central health check failed: {e}")

        self.consecutive_successes = 0
        self.consecutive_failures += 1
        if self.consecutive_failures >= 2:
            self.is_connected = False
        self.last_check = datetime.utcnow()
        return False

    async def start_monitoring(self):
        """Start continuous monitoring loop."""
        logger.info(f"Starting health monitoring every {self.check_interval}s")
        while True:
            await self.check_health()
            await asyncio.sleep(self.check_interval)

    def get_status(self) -> dict:
        """Get current status info."""
        return {
            "connected": self.is_connected,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes
        }


class SyncStateManager:
    """Manage sync state in database"""

    @staticmethod
    def get_last_sync(db: Session) -> Optional[datetime]:
        """Get last successful sync timestamp"""
        state = db.query(models.SyncState).filter(models.SyncState.key == "last_sync").first()
        if state and state.value:
            try:
                return datetime.fromisoformat(state.value)
            except ValueError:
                return None
        return None

    @staticmethod
    def update_last_sync(db: Session):
        """Update last sync timestamp to now"""
        now = datetime.utcnow().isoformat()
        state = db.query(models.SyncState).filter(models.SyncState.key == "last_sync").first()
        if state:
            state.value = now
            state.updated_at = datetime.utcnow()
        else:
            state = models.SyncState(key="last_sync", value=now)
            db.add(state)
        db.commit()

    @staticmethod
    def get_sync_info(db: Session) -> dict:
        """Get all sync state information"""
        last_sync = SyncStateManager.get_last_sync(db)
        return {
            "last_sync": last_sync.isoformat() if last_sync else None,
            "episode_count": db.query(models.Episode).count(),
            "synced_count": db.query(models.Episode).filter(models.Episode.synced_flag == True).count()
        }

    @staticmethod
    def get_last_upstream_sync(db: Session) -> Optional[datetime]:
        """Get last successful upstream (HL7) sync timestamp"""
        state = db.query(models.SyncState).filter(models.SyncState.key == "last_upstream_sync").first()
        if state and state.value:
            try:
                return datetime.fromisoformat(state.value)
            except ValueError:
                return None
        return None

    @staticmethod
    def update_last_upstream_sync(db: Session):
        """Update last upstream sync timestamp to now"""
        now = datetime.utcnow().isoformat()
        state = db.query(models.SyncState).filter(models.SyncState.key == "last_upstream_sync").first()
        if state:
            state.value = now
            state.updated_at = datetime.utcnow()
        else:
            state = models.SyncState(key="last_upstream_sync", value=now)
            db.add(state)
        db.commit()

    @staticmethod
    def get_sync_stats(db: Session) -> dict:
        """Get detailed synchronization statistics"""
        last_downstream_sync = SyncStateManager.get_last_sync(db)
        last_upstream_sync = SyncStateManager.get_last_upstream_sync(db)

        pending_outbox = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.status == "pending"
        ).count()

        failed_outbox = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.status == "failed"
        ).count()

        total_episodes = db.query(models.Episode).count()
        synced_episodes = db.query(models.Episode).filter(
            models.Episode.synced_flag == True
        ).count()

        return {
            "last_downstream_sync": last_downstream_sync.isoformat() if last_downstream_sync else None,
            "last_upstream_sync": last_upstream_sync.isoformat() if last_upstream_sync else None,
            "pending_events": pending_outbox,
            "failed_events": failed_outbox,
            "total_episodes": total_episodes,
            "synced_episodes": synced_episodes,
            "local_only_episodes": total_episodes - synced_episodes
        }


_health_checker_instance = None


def get_health_checker() -> CentralHealthChecker:
    """Get singleton health checker instance"""
    global _health_checker_instance
    if _health_checker_instance is None:
        _health_checker_instance = CentralHealthChecker(settings.CENTRAL_URL)
    return _health_checker_instance


class CentralDataSync:
    """Service to sync patient data from central server."""

    def __init__(self, central_url: str):
        self.central_url = central_url

    async def fetch_patient_data(self, user_filtros: str = "") -> Optional[List[dict]]:
        """Fetch patient data from central API with Basic Auth and user filters."""
        try:
            api_url = f"{self.central_url}{settings.CENTRAL_API_ENDPOINT}"
            auth = (settings.CENTRAL_API_USERNAME, settings.CENTRAL_API_PASSWORD)

            if user_filtros:
                api_url = f"{api_url}?{user_filtros}"

            logger.info(f"Fetching data from: {api_url}")
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(api_url, auth=auth)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        return data
                    logger.error(f"Expected list, got: {type(data)}")
                    return None
                else:
                    logger.error(f"Failed to fetch data: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error fetching data from central: {e}")
            return None

    def process_patient_data(self, db: Session, patients: List[dict]):
        """Process patient data from central API and store in local database.
        Updates existing episodes and adds new ones without deleting local data."""
        try:
            logger.info(f"Processing {len(patients)} episodes from central")

            central_episode_nums = set()
            for patient_data in patients:
                episode_num = self._process_episode(db, patient_data)
                if episode_num:
                    central_episode_nums.add(episode_num)

            db.commit()
            SyncStateManager.update_last_sync(db)
            logger.info("Episode data sync completed successfully")

        except Exception as e:
            logger.error(f"Error processing episode data: {e}")
            db.rollback()
            raise

    def _process_episode(self, db: Session, item: dict) -> Optional[str]:
        """Process individual episode item and store complete JSON.
        Returns the episode number if processed successfully."""
        try:
            mrn = item.get("MRN")
            num_episodio = item.get("NumEpisodio")

            if not mrn or not num_episodio:
                logger.warning("Skipping episode without MRN or NumEpisodio")
                return None

            existing = db.query(models.Episode).filter(
                models.Episode.num_episodio == num_episodio
            ).first()

            birth_date_str = item.get("FechaNacimiento")
            birth_date = None
            if birth_date_str:
                birth_date_str = birth_date_str.split("T")[0]
                birth_date = datetime.strptime(birth_date_str, "%Y-%m-%d")

            atencion_date_str = item.get("FechaAtencion")
            fecha_atencion = None
            if atencion_date_str:
                # Parse datetime with format "2025-10-26T16:35:54" or "2025-10-26 16:35:54"
                atencion_date_str = atencion_date_str.replace("T", " ")
                fecha_atencion = datetime.strptime(atencion_date_str, "%Y-%m-%d %H:%M:%S")

            # Format patient name as "Apellido, Nombres"
            apellidos = item.get("Apellidos", "")
            nombres = item.get("Nombres", "")
            if apellidos or nombres:
                nombre_paciente = f"{apellidos}, {nombres}".strip(", ")
            else:
                nombre_paciente = item.get("Nombre") or item.get("Paciente")

            if existing:
                existing.mrn = mrn
                existing.run = item.get("RUN")
                existing.paciente = nombre_paciente
                existing.fecha_nacimiento = birth_date
                existing.sexo = item.get("Sexo")
                existing.tipo = item.get("Tipo")
                existing.fecha_atencion = fecha_atencion
                existing.hospital = item.get("Hospital")
                existing.habitacion = item.get("Habitacion")
                existing.cama = item.get("Cama")
                existing.ubicacion = item.get("Local")
                existing.estado = item.get("Estado")
                existing.profesional = item.get("Profesional")
                existing.motivo_consulta = item.get("MotivoConsulta")
                existing.data_json = json.dumps(item, ensure_ascii=False)
                existing.synced_flag = True
                logger.debug(f"Updated existing episode: {num_episodio}")
            else:
                episode = models.Episode(
                    mrn=mrn,
                    num_episodio=num_episodio,
                    run=item.get("RUN"),
                    paciente=nombre_paciente,
                    fecha_nacimiento=birth_date,
                    sexo=item.get("Sexo"),
                    tipo=item.get("Tipo"),
                    fecha_atencion=fecha_atencion,
                    hospital=item.get("Hospital"),
                    habitacion=item.get("Habitacion"),
                    cama=item.get("Cama"),
                    ubicacion=item.get("Local"),
                    estado=item.get("Estado"),
                    profesional=item.get("Profesional"),
                    motivo_consulta=item.get("MotivoConsulta"),
                    data_json=json.dumps(item, ensure_ascii=False),
                    synced_flag=True
                )
                db.add(episode)
                logger.debug(f"Added new episode: {num_episodio}")
            db.flush()

            return num_episodio

        except Exception as e:
            logger.error(f"Error processing episode item: {e}")
            raise


async def start_health_monitoring():
    """Start the health monitoring service."""
    health_checker = get_health_checker()
    await health_checker.start_monitoring()


async def sync_from_central(user_filtros: str = ""):
    """Main function to sync data from central server with user-specific filters."""
    db = SessionLocal()
    try:
        sync = CentralDataSync(settings.CENTRAL_URL)
        patients = await sync.fetch_patient_data(user_filtros)

        if patients:
            sync.process_patient_data(db, patients)
            logger.info("Sync from central completed successfully")
        else:
            logger.warning("No data received from central")

    except Exception as e:
        logger.error(f"Error in sync_from_central: {e}")
    finally:
        db.close()
