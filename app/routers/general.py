from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
import httpx
from app import models, schemas
from app.db import get_db
from app.auth_utils import get_current_active_user, get_current_admin_user
from app.settings import settings

router = APIRouter(tags=["general"])


@router.get("/health")
def health_check():
    return {"status": "healthy", "service": "trakcare_offline_lan"}


@router.get("/health/central")
def check_central_health(current_user: models.User = Depends(get_current_active_user)):
    """Check central server reachability. Requires authentication in LAN mode."""
    try:
        with httpx.Client(timeout=5.0) as client:
            response = client.head(settings.CENTRAL_URL)
            if response.status_code < 500:
                return {"status": "online", "central_url": settings.CENTRAL_URL}
            return {"status": "offline", "central_url": settings.CENTRAL_URL}
    except Exception:
        return {"status": "offline", "central_url": settings.CENTRAL_URL}


@router.get("/sync/status", response_model=schemas.SyncStatus)
def get_sync_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    pending_events = db.query(models.OutboxEvent).filter(models.OutboxEvent.status == "pending").count()
    failed_events = db.query(models.OutboxEvent).filter(models.OutboxEvent.status == "failed").count()
    total_outbox_events = db.query(models.OutboxEvent).count()
    last_sync_record = db.query(models.SyncState).filter(models.SyncState.key == "last_sync").first()
    return {
        "pending_events": pending_events,
        "failed_events": failed_events,
        "total_outbox_events": total_outbox_events,
        "last_sync": last_sync_record.value if last_sync_record else None
    }


@router.get("/settings", response_model=schemas.SystemSettings)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    def get_bool_setting(key: str, default: bool) -> bool:
        record = db.query(models.SyncState).filter(models.SyncState.key == key).first()
        if record:
            return record.value.lower() == "true"
        return default

    return {
        "enable_read_only_mode": get_bool_setting("enable_read_only_mode", True),
        "enable_new_episode_button": get_bool_setting("enable_new_episode_button", False),
    }


@router.put("/settings", response_model=schemas.SystemSettings)
def update_system_settings(
    settings_update: schemas.SystemSettings,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    def upsert_setting(key: str, value: bool):
        record = db.query(models.SyncState).filter(models.SyncState.key == key).first()
        str_value = "true" if value else "false"
        if record:
            record.value = str_value
        else:
            db.add(models.SyncState(key=key, value=str_value))

    upsert_setting("enable_read_only_mode", settings_update.enable_read_only_mode)
    upsert_setting("enable_new_episode_button", settings_update.enable_new_episode_button)
    db.commit()
    return {
        "enable_read_only_mode": settings_update.enable_read_only_mode,
        "enable_new_episode_button": settings_update.enable_new_episode_button,
    }
