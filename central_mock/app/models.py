from sqlalchemy import String, Integer, DateTime, Boolean, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from typing import Optional
from app.db import Base


class CentralUser(Base):
    __tablename__ = "central_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="user")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_system: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


class CentralPatient(Base):
    __tablename__ = "central_patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    rut: Mapped[Optional[str]] = mapped_column(String(12), unique=True, nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    sex: Mapped[str] = mapped_column(String(1), nullable=False)
    birth_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    source_system: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


class CentralEpisode(Base):
    __tablename__ = "central_episodes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_id: Mapped[str] = mapped_column(String(36), unique=True, index=True, nullable=False)
    patient_source_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    episode_type: Mapped[str] = mapped_column(String(50), nullable=False)
    admission_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location_room_box: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    clinic_unit: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_system: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )


class HL7Message(Base):
    __tablename__ = "hl7_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    message_control_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), nullable=False)
    raw_message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="received")
    ack_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_system: Mapped[str] = mapped_column(String(100), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
