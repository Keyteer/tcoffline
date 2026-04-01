from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.db import get_db
from app import models
from app.settings import settings
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security_basic = HTTPBasic(auto_error=False)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])


def authenticate_user(db: Session, username: str, password: str) -> models.User | None:
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user


def _get_user_from_jwt(token: str, db: Session) -> models.User | None:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        username: str | None = payload.get("sub")
        if username is None:
            return None
    except JWTError:
        return None

    return db.query(models.User).filter(models.User.username == username).first()


def _get_user_from_basic(credentials: HTTPBasicCredentials, db: Session) -> models.User | None:
    user = db.query(models.User).filter(models.User.username == credentials.username).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        return None
    return user


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    credentials: HTTPBasicCredentials | None = Depends(security_basic),
    db: Session = Depends(get_db),
) -> models.User:
    """Authenticate via JWT Bearer token (preferred) or HTTP Basic (legacy)."""
    user: models.User | None = None

    # Try JWT first
    if token:
        user = _get_user_from_jwt(token, db)

    # Fall back to Basic auth
    if user is None and credentials:
        user = _get_user_from_basic(credentials, db)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
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
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    credentials: HTTPBasicCredentials | None = Depends(security_basic),
    db: Session = Depends(get_db),
) -> models.User | None:
    user: models.User | None = None

    if token:
        user = _get_user_from_jwt(token, db)

    if user is None and credentials:
        user = _get_user_from_basic(credentials, db)

    if user is None or not user.active:
        return None

    return user
