from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from app import models, schemas
from app.db import get_db

router = APIRouter(prefix="/central", tags=["health"])


@router.get("/health", response_model=schemas.HealthResponse)
def health_check(db: Session = Depends(get_db)):
    users_count = db.query(models.CentralUser).count()
    patients_count = db.query(models.CentralPatient).count()
    episodes_count = db.query(models.CentralEpisode).count()
    hl7_messages_count = db.query(models.HL7Message).count()
    hl7_pending = db.query(models.HL7Message).filter(
        models.HL7Message.status == "received"
    ).count()

    return {
        "status": "healthy",
        "service": "central_mock",
        "timestamp": datetime.utcnow(),
        "database": "connected",
        "stats": {
            "users": users_count,
            "patients": patients_count,
            "episodes": episodes_count,
            "hl7_messages_total": hl7_messages_count,
            "hl7_messages_pending": hl7_pending
        }
    }
