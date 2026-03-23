from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional


class CentralUserBase(BaseModel):
    username: str
    email: Optional[str] = None
    role: str = "user"
    active: bool = True
    source_system: Optional[str] = None


class CentralUser(CentralUserBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CentralPatientBase(BaseModel):
    source_id: str
    rut: Optional[str] = None
    first_name: str
    last_name: str
    sex: str
    birth_date: datetime
    source_system: str


class CentralPatient(CentralPatientBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CentralEpisodeBase(BaseModel):
    source_id: str
    patient_source_id: str
    episode_type: str
    admission_time: datetime
    location_room_box: Optional[str] = None
    clinic_unit: Optional[str] = None
    status_active: bool = True
    source_system: str


class CentralEpisode(CentralEpisodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HL7MessageRequest(BaseModel):
    message: str
    source_system: str = "offline_local"


class HL7MessageResponse(BaseModel):
    message_control_id: str
    ack_code: str
    message: str
    timestamp: datetime


class HL7MessageRecord(BaseModel):
    id: int
    message_control_id: str
    message_type: str
    status: str
    ack_code: Optional[str]
    error_message: Optional[str]
    source_system: str
    received_at: datetime
    processed_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
    database: str
    stats: dict
