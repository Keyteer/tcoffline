from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.settings import settings


def _build_engine():
    url = settings.DATABASE_URL
    kwargs: dict = {}

    if "sqlite" in url:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # Connection pooling for PostgreSQL
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
        kwargs["pool_pre_ping"] = True

    return create_engine(url, **kwargs)


engine = _build_engine()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
