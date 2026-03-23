from pydantic import BaseModel, ConfigDict, field_validator
from datetime import datetime
from typing import Optional, Any


class UserBase(BaseModel):
    username: str
    role: str = "user"
    active: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    password: Optional[str] = None
    nombre: Optional[str] = None
    filtros: Optional[str] = None


class UserCreateByAdmin(BaseModel):
    username: str
    password: str
    nombre: Optional[str] = None
    is_admin: bool = False


class User(UserBase):
    id: int
    is_admin: bool = False
    nombre: Optional[str] = None
    filtros: Optional[str] = None
    last_login: Optional[datetime] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EpisodeBase(BaseModel):
    mrn: str
    num_episodio: str
    run: Optional[str] = None
    paciente: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    sexo: Optional[str] = None
    tipo: Optional[str] = None
    fecha_atencion: Optional[datetime] = None
    hospital: Optional[str] = None
    habitacion: Optional[str] = None
    cama: Optional[str] = None
    ubicacion: Optional[str] = None
    estado: Optional[str] = None
    profesional: Optional[str] = None
    motivo_consulta: Optional[str] = None


class EpisodeCreate(BaseModel):
    mrn: str
    num_episodio: str
    run: Optional[str] = None
    paciente: Optional[str] = None
    fecha_nacimiento: Optional[datetime] = None
    sexo: Optional[str] = None
    tipo: Optional[str] = None
    fecha_atencion: Optional[datetime] = None
    hospital: Optional[str] = None
    habitacion: Optional[str] = None
    cama: Optional[str] = None
    ubicacion: Optional[str] = None
    estado: Optional[str] = None
    profesional: Optional[str] = None
    motivo_consulta: Optional[str] = None
    data_json: str

    @field_validator('fecha_nacimiento', 'fecha_atencion', mode='before')
    @classmethod
    def parse_dates(cls, v):
        if v is None or v == '':
            return None
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return None
        return v


class EpisodeUpdate(BaseModel):
    tipo: Optional[str] = None
    fecha_atencion: Optional[datetime] = None
    hospital: Optional[str] = None
    habitacion: Optional[str] = None
    cama: Optional[str] = None
    ubicacion: Optional[str] = None
    estado: Optional[str] = None
    profesional: Optional[str] = None
    motivo_consulta: Optional[str] = None
    data_json: Optional[str] = None


class Episode(EpisodeBase):
    id: int
    data_json: str
    created_at: datetime
    updated_at: datetime
    synced_flag: bool
    pending_notes_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class EpisodeDetail(Episode):
    """Episode with complete JSON data"""
    data: dict

    model_config = ConfigDict(from_attributes=True)


class ClinicalNoteBase(BaseModel):
    note_text: str


class ClinicalNoteCreate(ClinicalNoteBase):
    pass


class ClinicalNote(ClinicalNoteBase):
    id: int
    episode_id: int
    author_user_id: int
    created_at: datetime
    synced_flag: bool

    model_config = ConfigDict(from_attributes=True)


class ClinicalNoteWithAuthor(ClinicalNoteBase):
    id: int
    episode_id: int
    author_user_id: int
    author_username: str
    author_nombre: Optional[str] = None
    created_at: datetime
    synced_flag: bool

    model_config = ConfigDict(from_attributes=True)


class SyncStatus(BaseModel):
    pending_events: int
    failed_events: int
    last_sync: Optional[str] = None
    total_outbox_events: int


class SystemSettings(BaseModel):
    enable_read_only_mode: bool = True
