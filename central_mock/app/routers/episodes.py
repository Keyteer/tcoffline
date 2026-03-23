from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app import models, schemas
from app.db import get_db

router = APIRouter(prefix="/central/episodes", tags=["episodes"])


@router.post("", response_model=schemas.CentralEpisode, status_code=status.HTTP_201_CREATED)
def create_episode(
    episode: schemas.CentralEpisodeBase,
    db: Session = Depends(get_db)
):
    existing = db.query(models.CentralEpisode).filter(
        models.CentralEpisode.source_id == episode.source_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Episode with this source_id already exists"
        )

    db_episode = models.CentralEpisode(**episode.model_dump())
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)
    return db_episode


@router.get("", response_model=List[schemas.CentralEpisode])
def list_episodes(
    skip: int = 0,
    limit: int = 100,
    source_system: Optional[str] = None,
    episode_type: Optional[str] = None,
    from_date: Optional[datetime] = Query(None, alias="from"),
    to_date: Optional[datetime] = Query(None, alias="to"),
    db: Session = Depends(get_db)
):
    query = db.query(models.CentralEpisode)

    if source_system:
        query = query.filter(models.CentralEpisode.source_system == source_system)
    if episode_type:
        query = query.filter(models.CentralEpisode.episode_type == episode_type)
    if from_date:
        query = query.filter(models.CentralEpisode.admission_time >= from_date)
    if to_date:
        query = query.filter(models.CentralEpisode.admission_time <= to_date)

    episodes = query.offset(skip).limit(limit).all()
    return episodes


@router.get("/{episode_id}", response_model=schemas.CentralEpisode)
def get_episode(
    episode_id: int,
    db: Session = Depends(get_db)
):
    episode = db.query(models.CentralEpisode).filter(
        models.CentralEpisode.id == episode_id
    ).first()

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )
    return episode


@router.get("/by-source/{source_id}", response_model=schemas.CentralEpisode)
def get_episode_by_source(
    source_id: str,
    db: Session = Depends(get_db)
):
    episode = db.query(models.CentralEpisode).filter(
        models.CentralEpisode.source_id == source_id
    ).first()

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )
    return episode


@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(
    episode_id: int,
    db: Session = Depends(get_db)
):
    episode = db.query(models.CentralEpisode).filter(
        models.CentralEpisode.id == episode_id
    ).first()

    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    db.delete(episode)
    db.commit()
    return None
