from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from app import models, schemas
from app.db import get_db
from app.auth_utils import get_current_active_user

router = APIRouter(prefix="/episodes", tags=["episodes"])


@router.post("", response_model=schemas.Episode, status_code=status.HTTP_201_CREATED)
def create_episode(
    episode: schemas.EpisodeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    existing = db.query(models.Episode).filter(
        models.Episode.num_episodio == episode.num_episodio
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Episode with this number already exists"
        )

    episode_data = episode.model_dump()
    episode_data.pop('pending_notes_count', None)

    # Format patient name as "Apellido, Nombre"
    if 'paciente' in episode_data and episode_data['paciente']:
        parts = episode_data['paciente'].strip().split()
        if len(parts) >= 2:
            # Assume last part is Nombre and everything else is Apellido
            nombre = parts[-1]
            apellido = ' '.join(parts[:-1])
            episode_data['paciente'] = f"{apellido}, {nombre}"

    db_episode = models.Episode(**episode_data)
    db.add(db_episode)
    db.commit()
    db.refresh(db_episode)

    outbox_event = models.OutboxEvent(
        event_type="episode_created",
        correlation_id=db_episode.num_episodio,
        hl7_payload=None,
        status="pending",
        priority=2
    )
    db.add(outbox_event)
    db.commit()

    db_episode_dict = {
        'id': db_episode.id,
        'mrn': db_episode.mrn,
        'num_episodio': db_episode.num_episodio,
        'run': db_episode.run,
        'paciente': db_episode.paciente,
        'fecha_nacimiento': db_episode.fecha_nacimiento,
        'sexo': db_episode.sexo,
        'tipo': db_episode.tipo,
        'fecha_atencion': db_episode.fecha_atencion,
        'hospital': db_episode.hospital,
        'habitacion': db_episode.habitacion,
        'cama': db_episode.cama,
        'ubicacion': db_episode.ubicacion,
        'estado': db_episode.estado,
        'profesional': db_episode.profesional,
        'motivo_consulta': db_episode.motivo_consulta,
        'data_json': db_episode.data_json,
        'created_at': db_episode.created_at,
        'updated_at': db_episode.updated_at,
        'synced_flag': db_episode.synced_flag,
        'pending_notes_count': 0
    }

    return schemas.Episode(**db_episode_dict)


@router.get("/types/unique", response_model=List[str])
def get_unique_episode_types(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get all unique episode types from database"""
    types = db.query(models.Episode.tipo).filter(
        models.Episode.tipo.isnot(None),
        models.Episode.tipo != ''
    ).distinct().order_by(models.Episode.tipo).all()

    result = [tipo[0] for tipo in types if tipo[0] and tipo[0].strip()]
    return result


@router.get("/locations/unique", response_model=List[str])
def get_unique_locations(
    tipo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """Get all unique locations from database, optionally filtered by episode type"""
    query = db.query(models.Episode.ubicacion).filter(
        models.Episode.ubicacion.isnot(None),
        models.Episode.ubicacion != ''
    )

    if tipo:
        query = query.filter(models.Episode.tipo == tipo)

    locations = query.distinct().order_by(models.Episode.ubicacion).all()
    result = [loc[0] for loc in locations if loc[0] and loc[0].strip()]
    return result


@router.get("", response_model=List[schemas.Episode])
def list_episodes(
    skip: int = 0,
    limit: int = 100,
    episode_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    query = db.query(
        models.Episode,
        func.count(models.ClinicalNote.id).filter(models.ClinicalNote.synced_flag == False).label('pending_notes_count')
    ).outerjoin(models.ClinicalNote)

    if episode_type:
        query = query.filter(models.Episode.tipo == episode_type)

    query = query.group_by(models.Episode.id).order_by(models.Episode.fecha_atencion.desc())

    results = query.offset(skip).limit(limit).all()

    episodes_with_counts = []
    for episode, pending_count in results:
        episode_dict = {
            'id': episode.id,
            'mrn': episode.mrn,
            'num_episodio': episode.num_episodio,
            'run': episode.run,
            'paciente': episode.paciente,
            'fecha_nacimiento': episode.fecha_nacimiento,
            'sexo': episode.sexo,
            'tipo': episode.tipo,
            'fecha_atencion': episode.fecha_atencion,
            'hospital': episode.hospital,
            'habitacion': episode.habitacion,
            'cama': episode.cama,
            'ubicacion': episode.ubicacion,
            'estado': episode.estado,
            'profesional': episode.profesional,
            'motivo_consulta': episode.motivo_consulta,
            'data_json': episode.data_json,
            'created_at': episode.created_at,
            'updated_at': episode.updated_at,
            'synced_flag': episode.synced_flag,
            'pending_notes_count': pending_count or 0
        }
        episodes_with_counts.append(schemas.Episode(**episode_dict))

    return episodes_with_counts


@router.get("/{episode_id}", response_model=schemas.EpisodeDetail)
def get_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    return {
        **episode.__dict__,
        "data": episode.get_json_data()
    }


@router.put("/{episode_id}", response_model=schemas.Episode)
def update_episode(
    episode_id: int,
    episode_update: schemas.EpisodeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not db_episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    update_data = episode_update.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(db_episode, field, value)

    db.commit()
    db.refresh(db_episode)

    outbox_event = models.OutboxEvent(
        event_type="episode_updated",
        correlation_id=db_episode.num_episodio,
        hl7_payload=None,
        status="pending",
        priority=2
    )
    db.add(outbox_event)
    db.commit()

    return db_episode


@router.delete("/{episode_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_episode(
    episode_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    db_episode = db.query(models.Episode).filter(models.Episode.id == episode_id).first()
    if not db_episode:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Episode not found"
        )

    db.delete(db_episode)
    db.commit()
    return None
