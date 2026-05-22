from fastapi import FastAPI
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
    title="TrakCare Offline LAN",
    description="Backend LAN para gestión de datos clínicos en red local. JWT Auth, PostgreSQL, session-safe.",
    version="1.9.2-rc08"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    from app.background_tasks import start_background_tasks
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
            for event in pending_events:
                event.retry_count = 0
            db.commit()
            logger.info(f"Reset retry_count for {len(pending_events)} pending events")
        else:
            logger.info("No pending events to reset")
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
        "message": "TrakCare Offline LAN API",
        "version": "1.9.2-rc08",
        "mode": "lan",
        "auth": "JWT Bearer",
        "docs": "/docs"
    }
