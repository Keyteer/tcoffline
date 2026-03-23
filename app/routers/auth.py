from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth_utils import get_current_active_user, get_current_admin_user
from app.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


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
