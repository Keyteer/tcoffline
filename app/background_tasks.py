import asyncio
from datetime import datetime
from app.settings import settings
from app.outbox_processor import OutboxProcessor
from app.sync_service import start_health_monitoring, sync_from_central
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SyncScheduler:
    """
    Scheduler for periodic synchronization tasks.
    Separate intervals for downstream (GET) and upstream (POST) syncs.
    """

    def __init__(self, downstream_interval: int = 300, upstream_interval: int = 180):
        self.downstream_interval = downstream_interval
        self.upstream_interval = upstream_interval
        self.processor = OutboxProcessor(settings.CENTRAL_URL)
        self.is_running = False

    async def run_downstream_sync(self):
        """Download data from central (GET) using filters from the most recently logged in user"""
        logger.info("Starting downstream sync (GET from central)...")
        try:
            from app.db import SessionLocal
            from app import models

            db = SessionLocal()
            try:
                most_recent_user = db.query(models.User).filter(
                    models.User.active == True,
                    models.User.last_login.isnot(None)
                ).order_by(models.User.last_login.desc()).first()

                user_filtros = most_recent_user.filtros if most_recent_user and most_recent_user.filtros else ""

                if most_recent_user:
                    logger.info(f"Using filters from most recently logged in user '{most_recent_user.username}' (last login: {most_recent_user.last_login}): {user_filtros}")
                else:
                    logger.info("No user has logged in yet, syncing without filters")

                await sync_from_central(user_filtros)
                logger.info("Downstream sync completed")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in downstream sync: {e}")

    async def run_upstream_sync(self):
        """Send local changes to central (POST HL7)"""
        logger.info("=" * 80)
        logger.info("UPSTREAM SYNC - Sending pending events to central server")
        logger.info("=" * 80)
        try:
            await self.processor.retry_failed_events()
            await self.processor.process_pending_events()
            logger.info("=" * 80)
            logger.info("UPSTREAM SYNC COMPLETED")
            logger.info("=" * 80)
        except Exception as e:
            logger.error(f"Error in upstream sync: {e}")

    async def downstream_loop(self):
        """Continuous loop for downstream sync"""
        while self.is_running:
            try:
                await self.run_downstream_sync()
            except Exception as e:
                logger.error(f"Error in downstream loop: {e}")
            await asyncio.sleep(self.downstream_interval)

    async def upstream_loop(self):
        """Continuous loop for upstream sync"""
        while self.is_running:
            try:
                await self.run_upstream_sync()
            except Exception as e:
                logger.error(f"Error in upstream loop: {e}")
            await asyncio.sleep(self.upstream_interval)

    async def start(self):
        """Start both sync loops"""
        logger.info(f"Starting sync scheduler:")
        logger.info(f"  - Downstream (GET): {self.downstream_interval}s ({self.downstream_interval//60}min)")
        logger.info(f"  - Upstream (POST): {self.upstream_interval}s ({self.upstream_interval//60}min)")
        self.is_running = True

        await asyncio.gather(
            self.downstream_loop(),
            self.upstream_loop(),
            return_exceptions=True
        )

    def stop(self):
        """Stop the sync scheduler"""
        logger.info("Stopping sync scheduler")
        self.is_running = False


async def start_background_tasks():
    """
    Start all background tasks:
    - Health monitoring (every 8 seconds)
    - Downstream sync (GET from central)
    - Upstream sync (POST HL7 to central)
    """
    logger.info("Starting background tasks...")

    health_task = asyncio.create_task(start_health_monitoring())
    logger.info("Health monitoring task started")

    sync_scheduler = SyncScheduler(
        downstream_interval=settings.DOWNSTREAM_SYNC_INTERVAL,
        upstream_interval=settings.UPSTREAM_SYNC_INTERVAL
    )
    sync_task = asyncio.create_task(sync_scheduler.start())
    logger.info("Sync scheduler task started")

    await asyncio.gather(health_task, sync_task, return_exceptions=True)
