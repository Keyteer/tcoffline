from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app import models, schemas
from app.db import get_db
from app.hl7_handler import (
    parse_hl7_message,
    generate_ack,
    validate_hl7_message
)

router = APIRouter(prefix="/central/hl7", tags=["hl7"])


@router.post("", response_model=schemas.HL7MessageResponse)
def receive_hl7_message(
    message_req: schemas.HL7MessageRequest,
    db: Session = Depends(get_db)
):
    """
    Receive and process HL7 message.
    Returns ACK (AA) on success or NAK (AE/AR) on error.
    """
    is_valid, validation_error = validate_hl7_message(message_req.message)

    if not is_valid:
        ack_message = generate_ack(
            message_control_id=f"ERR_{datetime.utcnow().timestamp()}",
            ack_code="AR",
            error_message=validation_error
        )
        return {
            "message_control_id": f"ERR_{datetime.utcnow().timestamp()}",
            "ack_code": "AR",
            "message": ack_message,
            "timestamp": datetime.utcnow()
        }

    success, error_msg, parsed_data = parse_hl7_message(message_req.message)

    if not success:
        ack_message = generate_ack(
            message_control_id=f"ERR_{datetime.utcnow().timestamp()}",
            ack_code="AE",
            error_message=error_msg
        )

        db_message = models.HL7Message(
            message_control_id=f"ERR_{datetime.utcnow().timestamp()}",
            message_type="UNKNOWN",
            raw_message=message_req.message,
            status="error",
            ack_code="AE",
            error_message=error_msg,
            source_system=message_req.source_system,
            processed_at=datetime.utcnow()
        )
        db.add(db_message)
        db.commit()

        return {
            "message_control_id": f"ERR_{datetime.utcnow().timestamp()}",
            "ack_code": "AE",
            "message": ack_message,
            "timestamp": datetime.utcnow()
        }

    control_id = parsed_data["control_id"]

    existing = db.query(models.HL7Message).filter(
        models.HL7Message.message_control_id == control_id
    ).first()

    if existing:
        ack_message = generate_ack(
            message_control_id=control_id,
            ack_code="AR",
            error_message="Duplicate message control ID"
        )
        return {
            "message_control_id": control_id,
            "ack_code": "AR",
            "message": ack_message,
            "timestamp": datetime.utcnow()
        }

    db_message = models.HL7Message(
        message_control_id=control_id,
        message_type=parsed_data["message_type"],
        raw_message=message_req.message,
        status="processed",
        ack_code="AA",
        source_system=message_req.source_system,
        processed_at=datetime.utcnow()
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    ack_message = generate_ack(
        message_control_id=control_id,
        ack_code="AA"
    )

    return {
        "message_control_id": control_id,
        "ack_code": "AA",
        "message": ack_message,
        "timestamp": datetime.utcnow()
    }


@router.get("/messages", response_model=List[schemas.HL7MessageRecord])
def list_hl7_messages(
    skip: int = 0,
    limit: int = 100,
    status_filter: str = None,
    db: Session = Depends(get_db)
):
    """
    List all received HL7 messages with optional status filter.
    """
    query = db.query(models.HL7Message)

    if status_filter:
        query = query.filter(models.HL7Message.status == status_filter)

    messages = query.order_by(models.HL7Message.received_at.desc()).offset(skip).limit(limit).all()
    return messages


@router.get("/messages/{message_id}", response_model=schemas.HL7MessageRecord)
def get_hl7_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """
    Get a specific HL7 message by ID.
    """
    message = db.query(models.HL7Message).filter(models.HL7Message.id == message_id).first()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HL7 message not found"
        )
    return message


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_hl7_message(
    message_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a specific HL7 message.
    """
    message = db.query(models.HL7Message).filter(models.HL7Message.id == message_id).first()

    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HL7 message not found"
        )

    db.delete(message)
    db.commit()
    return None
