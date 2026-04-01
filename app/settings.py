import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://tcoffline:tcoffline@localhost:5432/tcoffline"
    ENVIRONMENT: str = "development"

    CENTRAL_URL: str = "http://demo01.tcdb.vtas.cl.intersystems.com"
    CENTRAL_API_ENDPOINT: str = "/demo01/tcoffline/getData"
    CENTRAL_HL7_ENDPOINT: str = "/demo01/tcoffline/hl7inbound"
    CENTRAL_API_USERNAME: str = "demo"
    CENTRAL_API_PASSWORD: str = "demodemo"

    HEALTH_CHECK_INTERVAL: int = 8
    DOWNSTREAM_SYNC_INTERVAL: int = 60
    UPSTREAM_SYNC_INTERVAL: int = 10
    MAX_RETRIES: int = 5

    DEFAULT_LANGUAGE: str = "es"

    # JWT settings
    JWT_SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS settings
    CORS_ORIGINS: str = "*"

    # Discovery / connectivity
    SERVER_NAME: str = "TrakCare Offline"
    MDNS_ENABLED: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
