from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth_utils import (
    get_current_active_user, get_current_admin_user,
    authenticate_user, create_access_token, create_refresh_token, decode_token,
)
from app.db import get_db
from jose import JWTError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Authenticate with username/password, receive JWT tokens."""
    user = authenticate_user(db, body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    if not user.active:
        raise HTTPException(status_code=403, detail="Inactive user")

    token_data = {"sub": user.username}
    return schemas.TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh_token(body: schemas.RefreshRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new token pair."""
    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    username: str | None = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or not user.active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    token_data = {"sub": user.username}
    return schemas.TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=schemas.User)
def update_current_user(
    user_update: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    if user_update.password is not None:
        current_user.hashed_password = models.User.hash_password(user_update.password)

    if user_update.nombre is not None:
        current_user.nombre = user_update.nombre

    if user_update.filtros is not None:
        current_user.filtros = user_update.filtros

    db.commit()
    db.refresh(current_user)

    return current_user


@router.post("/users", response_model=schemas.User)
def create_user(
    user_data: schemas.UserCreateByAdmin,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = models.User(
        username=user_data.username,
        hashed_password=models.User.hash_password(user_data.password),
        nombre=user_data.nombre,
        is_admin=user_data.is_admin,
        active=True,
        role="user"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/users", response_model=list[schemas.User])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    users = db.query(models.User).order_by(models.User.username).all()
    return users
