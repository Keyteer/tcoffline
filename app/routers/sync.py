from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.db import get_db
from app.auth_utils import get_current_active_user
from app import models
from app.sync_service import get_health_checker, SyncStateManager, sync_from_central
from app.outbox_processor import OutboxProcessor
from app.settings import settings
import asyncio

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post("/trigger")
async def trigger_sync_manually(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Manually trigger synchronization of pending outbox events.
    """
    processor = OutboxProcessor(settings.CENTRAL_URL)

    pending_count = db.query(models.OutboxEvent).filter(
        models.OutboxEvent.status == "pending"
    ).count()

    async def run_sync():
        await processor.process_pending_events()

    asyncio.create_task(run_sync())

    return {
        "message": "Sync triggered",
        "pending_events": pending_count
    }


@router.post("/retry-failed")
async def retry_failed_events(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Reset failed events to pending for retry.
    """
    processor = OutboxProcessor(settings.CENTRAL_URL)

    failed_count = db.query(models.OutboxEvent).filter(
        models.OutboxEvent.status == "failed"
    ).count()

    async def run_retry():
        await processor.retry_failed_events()
        await processor.process_pending_events()

    asyncio.create_task(run_retry())

    return {
        "message": "Failed events reset for retry",
        "failed_events": failed_count
    }


@router.get("/connection-status")
def get_connection_status(
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Get current connection status to central server.
    """
    checker = get_health_checker()
    status = checker.get_status()
    return {
        "is_online": status["connected"],
        "last_check": status["last_check"]
    }


@router.get("/stats")
def get_sync_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Get detailed synchronization statistics.
    """
    stats = SyncStateManager.get_sync_stats(db)
    checker = get_health_checker()
    status = checker.get_status()

    return {
        **stats,
        "connection": {
            "is_online": status["connected"],
            "last_check": status["last_check"]
        }
    }


@router.post("/from-central")
async def sync_from_central_api(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Trigger synchronization from central API.
    Updates existing episodes and adds new ones while preserving local notes.
    Returns the updated episodes list.
    Uses the current user's filtros for the sync.
    """
    user_filtros = current_user.filtros if current_user.filtros else ""
    await sync_from_central(user_filtros)

    episodes = db.query(models.Episode).order_by(
        models.Episode.fecha_atencion.desc()
    ).all()

    return {
        "message": "Sync from central completed",
        "episodes": [
            {
                "id": ep.id,
                "num_episodio": ep.num_episodio,
                "mrn": ep.mrn,
                "run": ep.run,
                "paciente": ep.paciente,
                "fecha_nacimiento": ep.fecha_nacimiento.isoformat() if ep.fecha_nacimiento else None,
                "sexo": ep.sexo,
                "tipo": ep.tipo,
                "fecha_atencion": ep.fecha_atencion.isoformat() if ep.fecha_atencion else None,
                "hospital": ep.hospital,
                "habitacion": ep.habitacion,
                "cama": ep.cama,
                "ubicacion": ep.ubicacion,
                "estado": ep.estado,
                "synced_flag": ep.synced_flag
            }
            for ep in episodes
        ]
    }
