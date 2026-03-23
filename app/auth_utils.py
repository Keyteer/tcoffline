from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session
from app.db import get_db
from app import models
from datetime import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBasic()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def get_current_user(
    credentials: HTTPBasicCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    user = db.query(models.User).filter(models.User.username == credentials.username).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )

    user.last_login = datetime.utcnow()
    db.commit()

    return user


def get_current_active_user(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if not current_user.active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user


def get_current_admin_user(
    current_user: models.User = Depends(get_current_active_user)
) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can perform this action"
        )
    return current_user


def get_optional_current_user(
    db: Session = Depends(get_db),
    credentials: HTTPBasicCredentials = Depends(HTTPBasic(auto_error=False))
) -> models.User | None:
    if not credentials:
        return None

    user = db.query(models.User).filter(models.User.username == credentials.username).first()

    if not user or not verify_password(credentials.password, user.hashed_password):
        return None

    if not user.active:
        return None

    return user
