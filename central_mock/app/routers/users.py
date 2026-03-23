from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app import models, schemas
from app.db import get_db

router = APIRouter(prefix="/central/users", tags=["users"])


@router.post("", response_model=schemas.CentralUser, status_code=status.HTTP_201_CREATED)
def create_user(
    user: schemas.CentralUserBase,
    db: Session = Depends(get_db)
):
    existing = db.query(models.CentralUser).filter(
        models.CentralUser.username == user.username
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    db_user = models.CentralUser(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("", response_model=List[schemas.CentralUser])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    users = db.query(models.CentralUser).offset(skip).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=schemas.CentralUser)
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(models.CentralUser).filter(models.CentralUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(models.CentralUser).filter(models.CentralUser.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    db.delete(user)
    db.commit()
    return None
