from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, episodes, notes, general, sync, patients
from app.db import Base, engine
from app.settings import settings
import asyncio
import logging

# Configure root logger from settings
_log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.WARNING)
logging.basicConfig(
    level=_log_level,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Uvicorn access logs: suppress entirely in prod, keep in verbose dev mode
_uvicorn_access = logging.getLogger("uvicorn.access")
if settings.LOG_VERBOSE:
    _uvicorn_access.setLevel(logging.DEBUG)
else:
    _uvicorn_access.setLevel(logging.ERROR)

# Suppress noisy library loggers
logging.getLogger("uvicorn.error").setLevel(_log_level)
logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TrakCare Offline Local",
    description="Backend local para gestión offline de datos clínicos",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if settings.CORS_ORIGINS != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_language_header(request: Request, call_next):
    lang = request.headers.get("Accept-Language", settings.DEFAULT_LANGUAGE)
    if lang not in ["es", "en"]:
        lang = settings.DEFAULT_LANGUAGE
    request.state.lang = lang
    response = await call_next(request)
    return response


@app.on_event("startup")
async def startup_event():
    """Start background tasks and initial sync on application startup"""
    from app.background_tasks import start_background_tasks
    from app.sync_service import sync_from_central
    from app.db import SessionLocal
    from app import models
    import logging

    logger = logging.getLogger(__name__)

    logger.info("Resetting retry counts for pending outbox events...")
    db = SessionLocal()
    try:
        pending_events = db.query(models.OutboxEvent).filter(
            models.OutboxEvent.status == "pending"
        ).all()

        if pending_events:
            logger.info(f"Resetting retry_count for {len(pending_events)} pending events")
            for event in pending_events:
                event.retry_count = 0
            db.commit()
            logger.info("Retry counts reset successfully")
        else:
            logger.info("No pending events to reset")

        # Get first active user's filters for initial sync
        if settings.AUTO_SYNC_ENABLED:
            logger.info("Performing initial data sync from central...")
            first_user = db.query(models.User).filter(
                models.User.active == True
            ).first()

            user_filtros = first_user.filtros if first_user and first_user.filtros else ""

            if user_filtros:
                logger.info(f"Using filters from user '{first_user.username}' for initial sync: {user_filtros}")
            else:
                logger.info("No user filters configured, performing initial sync without filters")

            await sync_from_central(user_filtros)
            logger.info("Initial sync completed successfully")
        else:
            logger.info("AUTO_SYNC_ENABLED=false — skipping initial sync from central")

    except Exception as e:
        logger.error(f"Error in startup tasks: {e}")
        db.rollback()
    finally:
        db.close()

    if settings.AUTO_SYNC_ENABLED:
        asyncio.create_task(start_background_tasks())
    else:
        logger.info("AUTO_SYNC_ENABLED=false — background sync and health check are disabled. Use /sync endpoints to sync manually.")


app.include_router(general.router)
app.include_router(auth.router)
app.include_router(episodes.router)
app.include_router(notes.router)
app.include_router(sync.router)
app.include_router(patients.router)


@app.get("/")
def root():
    return {
        "message": "TrakCare Offline Local API",
        "version": "2.0.0",
        "docs": "/docs"
    }
