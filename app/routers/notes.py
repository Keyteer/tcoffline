from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.db import get_db
from app.auth_utils import get_current_active_user

router = APIRouter(prefix="/episodes", tags=["notes"])


@router.post("/{episode_id}/notes", response_model=schemas.ClinicalNote, status_code=status.HTTP_201_CREATED)
def create_clinical_note(
    episode_id: int,
    note: schemas.ClinicalNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    db_note = models.ClinicalNote(
        episode_id=episode_id,
        author_user_id=current_user.id,
        author_nombre=current_user.nombre,
        note_text=note.note_text
    )
    db.add(db_note)
    db.commit()
    db.refresh(db_note)

    outbox_event = models.OutboxEvent(
        event_type="clinical_note_created",
        correlation_id=str(db_note.id),
        hl7_payload=None,
        status="pending",
        priority=3
    )
    db.add(outbox_event)
    db.commit()

    return db_note


@router.get("/{episode_id}/notes", response_model=List[schemas.ClinicalNoteWithAuthor])
def list_episode_notes(
    episode_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    notes = db.query(
        models.ClinicalNote,
        models.User.username,
        models.User.nombre
    ).join(
        models.User,
        models.ClinicalNote.author_user_id == models.User.id
    ).filter(
        models.ClinicalNote.episode_id == episode_id
    ).order_by(
        models.ClinicalNote.created_at.desc()
    ).offset(skip).limit(limit).all()

    result = []
    for note, username, nombre in notes:
        result.append({
            "id": note.id,
            "episode_id": note.episode_id,
            "author_user_id": note.author_user_id,
            "author_username": username,
            "author_nombre": note.author_nombre or nombre,
            "note_text": note.note_text,
            "created_at": note.created_at,
            "synced_flag": note.synced_flag
        })

    return result


@router.get("/{episode_id}/notes/{note_id}", response_model=schemas.ClinicalNote)
def get_clinical_note(
    episode_id: int,
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    note = db.query(models.ClinicalNote).filter(
        models.ClinicalNote.id == note_id,
        models.ClinicalNote.episode_id == episode_id
    ).first()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clinical note not found"
        )
    return note
