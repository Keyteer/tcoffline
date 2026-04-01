from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
import httpx
import socket
import platform
from app import models, schemas
from app.db import get_db
from app.auth_utils import get_current_active_user, get_current_admin_user, get_optional_current_user
from app.settings import settings
from app.dependencies import get_lang

router = APIRouter(tags=["general"])


@router.get("/health")
def health_check(request: Request):
    lang = get_lang(request)
    return {"status": "healthy", "service": "trakcare_offline_local", "language": lang}


@router.get("/discovery")
def discovery(request: Request):
    """Public endpoint for clients to discover and identify this server."""
    hostname = socket.gethostname()
    try:
        local_ip = socket.gethostbyname(hostname)
    except socket.gaierror:
        local_ip = "127.0.0.1"

    return {
        "service": "trakcare_offline",
        "name": settings.SERVER_NAME,
        "version": "2.0.0",
        "hostname": hostname,
        "ip": local_ip,
        "port": 8000,
        "platform": platform.system(),
        "auth_methods": ["jwt", "basic"],
    }


@router.get("/health/central")
def check_central_health(
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_optional_current_user)
):
    try:
        auth = (settings.CENTRAL_API_USERNAME, settings.CENTRAL_API_PASSWORD)
        api_url = f"{settings.CENTRAL_URL}{settings.CENTRAL_API_ENDPOINT}"

        if current_user and current_user.filtros:
            api_url = f"{api_url}?{current_user.filtros}"

        with httpx.Client(timeout=5.0, auth=auth) as client:
            response = client.get(api_url)
            if response.status_code == 200:
                return {"status": "online", "central_url": settings.CENTRAL_URL}
            return {"status": "offline", "central_url": settings.CENTRAL_URL}
    except Exception:
        return {"status": "offline", "central_url": settings.CENTRAL_URL}


@router.get("/sync/status", response_model=schemas.SyncStatus)
def get_sync_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    pending_events = db.query(models.OutboxEvent).filter(
        models.OutboxEvent.status == "pending"
    ).count()

    failed_events = db.query(models.OutboxEvent).filter(
        models.OutboxEvent.status == "failed"
    ).count()

    total_outbox_events = db.query(models.OutboxEvent).count()

    last_sync_record = db.query(models.SyncState).filter(
        models.SyncState.key == "last_sync"
    ).first()

    last_sync = last_sync_record.value if last_sync_record else None

    return {
        "pending_events": pending_events,
        "failed_events": failed_events,
        "total_outbox_events": total_outbox_events,
        "last_sync": last_sync
    }


@router.get("/settings", response_model=schemas.SystemSettings)
def get_system_settings(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get system settings"""
    read_only_record = db.query(models.SyncState).filter(
        models.SyncState.key == "enable_read_only_mode"
    ).first()

    enable_read_only = True
    if read_only_record:
        enable_read_only = read_only_record.value.lower() == "true"

    return {"enable_read_only_mode": enable_read_only}


@router.put("/settings", response_model=schemas.SystemSettings)
def update_system_settings(
    settings_update: schemas.SystemSettings,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Update system settings - Admin only"""
    read_only_record = db.query(models.SyncState).filter(
        models.SyncState.key == "enable_read_only_mode"
    ).first()

    value = "true" if settings_update.enable_read_only_mode else "false"

    if read_only_record:
        read_only_record.value = value
    else:
        read_only_record = models.SyncState(
            key="enable_read_only_mode",
            value=value
        )
        db.add(read_only_record)

    db.commit()

    return {"enable_read_only_mode": settings_update.enable_read_only_mode}
