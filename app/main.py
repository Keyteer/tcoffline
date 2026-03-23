from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, episodes, notes, general, sync
from app.db import Base, engine
from app.settings import settings
import asyncio
import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find("GET /auth/me") == -1

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="TrakCare Offline Local",
    description="Backend local para gestión offline de datos clínicos",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

    except Exception as e:
        logger.error(f"Error in startup tasks: {e}")
        db.rollback()
    finally:
        db.close()

    asyncio.create_task(start_background_tasks())

app.include_router(general.router)
app.include_router(auth.router)
app.include_router(episodes.router)
app.include_router(notes.router)
app.include_router(sync.router)


@app.get("/")
def root():
    return {
        "message": "TrakCare Offline Local API",
        "version": "2.0.0",
        "docs": "/docs"
    }
