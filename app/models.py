from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from app.db import Base
from passlib.context import CryptContext
import json

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="user")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    nombre: Mapped[str] = mapped_column(String(200), nullable=True)
    filtros: Mapped[str] = mapped_column(Text, nullable=True)
    last_login: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(back_populates="author")

    def verify_password(self, password: str) -> bool:
        return pwd_context.verify(password, self.hashed_password)

    @staticmethod
    def hash_password(password: str) -> str:
        return pwd_context.hash(password)


class Episode(Base):
    """
    Tabla unificada que almacena episodios completos con su JSON original.
    Campos indexados del primer nivel para búsquedas y listados.
    El JSON completo se almacena para acceso detallado a antecedentes e historia.
    """
    __tablename__ = "episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    mrn: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    num_episodio: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)

    run: Mapped[str] = mapped_column(String(20), nullable=True)
    paciente: Mapped[str] = mapped_column(String(200), nullable=True)
    fecha_nacimiento: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    sexo: Mapped[str] = mapped_column(String(10), nullable=True)

    tipo: Mapped[str] = mapped_column(String(50), nullable=True)
    fecha_atencion: Mapped[datetime] = mapped_column(DateTime, nullable=True, index=True)
    hospital: Mapped[str] = mapped_column(String(100), nullable=True)
    habitacion: Mapped[str] = mapped_column(String(50), nullable=True)
    cama: Mapped[str] = mapped_column(String(50), nullable=True)
    ubicacion: Mapped[str] = mapped_column(String(100), nullable=True)
    estado: Mapped[str] = mapped_column(String(50), nullable=True)
    profesional: Mapped[str] = mapped_column(String(200), nullable=True)
    motivo_consulta: Mapped[str] = mapped_column(Text, nullable=True)

    data_json: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    synced_flag: Mapped[bool] = mapped_column(Boolean, default=False)

    clinical_notes: Mapped[list["ClinicalNote"]] = relationship(back_populates="episode", cascade="all, delete-orphan")

    def get_json_data(self) -> dict:
        """Retorna el JSON completo parseado"""
        return json.loads(self.data_json)

    def set_json_data(self, data: dict):
        """Actualiza el JSON completo"""
        self.data_json = json.dumps(data, ensure_ascii=False)


class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    episode_id: Mapped[int] = mapped_column(Integer, ForeignKey("episodes.id"), index=True, nullable=False)
    author_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    author_nombre: Mapped[str] = mapped_column(String(200), nullable=True)
    note_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    synced_flag: Mapped[bool] = mapped_column(Boolean, default=False)

    episode: Mapped["Episode"] = relationship(back_populates="clinical_notes")
    author: Mapped["User"] = relationship(back_populates="clinical_notes")


class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    correlation_id: Mapped[str] = mapped_column(String(100), nullable=False)
    hl7_payload: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    priority: Mapped[int] = mapped_column(Integer, default=5)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    last_error: Mapped[str] = mapped_column(Text, nullable=True)


class SyncState(Base):
    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
