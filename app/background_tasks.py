import asyncio
from app.settings import settings
from app.outbox_processor import OutboxProcessor
from app.sync_service import start_health_monitoring, sync_from_central
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SyncScheduler:
    """
    Scheduler for periodic synchronization tasks.
    Downstream sync uses no user-specific filters since there is no session in background context.
    For user-specific downstream sync, use POST /sync/from-central from the frontend.
    """

    def __init__(self, downstream_interval: int = 300, upstream_interval: int = 180):
        self.downstream_interval = downstream_interval
        self.upstream_interval = upstream_interval
        self.processor = OutboxProcessor(settings.CENTRAL_URL)
        self.is_running = False

    async def run_downstream_sync(self):
        """
        Background downstream sync runs without user filters.
        User-filtered syncs must be triggered explicitly via the API (POST /sync/from-central)
        using the current session user's filtros.
        """
        logger.info("Starting background downstream sync (no user filters)...")
        try:
            await sync_from_central("")
            logger.info("Background downstream sync completed")
        except Exception as e:
            logger.error(f"Error in downstream sync: {e}")

    async def run_upstream_sync(self):
        logger.info("=" * 80)
        logger.info("UPSTREAM SYNC - Sending pending events to central server")
        logger.info("=" * 80)
        try:
            await self.processor.retry_failed_events()
            await self.processor.process_pending_events()
            logger.info("UPSTREAM SYNC COMPLETED")
            logger.info("=" * 80)
        except Exception as e:
            logger.error(f"Error in upstream sync: {e}")

    async def downstream_loop(self):
        while self.is_running:
            try:
                await self.run_downstream_sync()
            except Exception as e:
                logger.error(f"Error in downstream loop: {e}")
            await asyncio.sleep(self.downstream_interval)

    async def upstream_loop(self):
        while self.is_running:
            try:
                await self.run_upstream_sync()
            except Exception as e:
                logger.error(f"Error in upstream loop: {e}")
            await asyncio.sleep(self.upstream_interval)

    async def start(self):
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
        logger.info("Stopping sync scheduler")
        self.is_running = False


async def start_background_tasks():
    logger.info("Starting background tasks...")
    health_task = asyncio.create_task(start_health_monitoring())
    sync_scheduler = SyncScheduler(
        downstream_interval=settings.DOWNSTREAM_SYNC_INTERVAL,
        upstream_interval=settings.UPSTREAM_SYNC_INTERVAL
    )
    sync_task = asyncio.create_task(sync_scheduler.start())
    await asyncio.gather(health_task, sync_task, return_exceptions=True)
