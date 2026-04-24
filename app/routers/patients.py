from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import models
from app.db import get_db
from app.auth_utils import get_current_active_user
from app.hl7_builder import HL7MessageBuilder

router = APIRouter(prefix="/patients", tags=["patients"])


@router.delete("/{mrn}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(
    mrn: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    """
    Delete a patient (person record) and all of their local episodes.

    Sends ADT^A23 to central for each synced episode and ADT^A29 for the
    patient itself. Local-only episodes (OFFE*) and patients (OFFP*) are
    removed without notifying central.
    """
    episodes = db.query(models.Episode).filter(models.Episode.mrn == mrn).all()
    if not episodes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    builder = HL7MessageBuilder()
    reference_episode = episodes[0]
    is_patient_synced = not mrn.startswith("OFFP")

    for ep in episodes:
        episode_synced = is_patient_synced and not ep.num_episodio.startswith("OFFE")
        if episode_synced:
            full_name = ep.paciente if ep.paciente else "Unknown Patient"
            a23_message, _ = builder.build_a23_message(
                patient_id=ep.mrn,
                rut=ep.run,
                last_name=full_name,
                first_name="",
                birth_date=ep.fecha_nacimiento,
                sex=ep.sexo,
                episode_id=ep.num_episodio,
            )
            db.add(models.OutboxEvent(
                event_type="episode_deleted",
                correlation_id=ep.num_episodio,
                hl7_payload=a23_message,
                status="pending",
                priority=2
            ))
        db.delete(ep)

    if is_patient_synced:
        full_name = reference_episode.paciente if reference_episode.paciente else "Unknown Patient"
        a29_message, _ = builder.build_a29_message(
            patient_id=mrn,
            rut=reference_episode.run,
            last_name=full_name,
            first_name="",
            birth_date=reference_episode.fecha_nacimiento,
            sex=reference_episode.sexo,
        )
        db.add(models.OutboxEvent(
            event_type="patient_deleted",
            correlation_id=mrn,
            hl7_payload=a29_message,
            status="pending",
            priority=2
        ))

    db.commit()
    return None
