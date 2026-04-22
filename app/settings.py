from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://tcoffline:tcoffline@localhost:5432/tcoffline"
    ENVIRONMENT: str = "development"

    CENTRAL_URL: str
    CENTRAL_API_ENDPOINT: str
    CENTRAL_HL7_ENDPOINT: str
    CENTRAL_API_USERNAME: str
    CENTRAL_API_PASSWORD: str

    AUTO_SYNC_ENABLED: bool = True
    HEALTH_CHECK_INTERVAL: int = 8
    DOWNSTREAM_SYNC_INTERVAL: int = 60
    UPSTREAM_SYNC_INTERVAL: int = 10
    MAX_RETRIES: int = 5

    DEFAULT_LANGUAGE: str = "es"

    # JWT settings
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS settings
    CORS_ORIGINS: str = "*"

    # Logging
    LOG_LEVEL: str = "WARNING"  # WARNING (prod) | DEBUG (dev)
    LOG_VERBOSE: bool = False   # True: full request/connection/endpoint logs

    SERVER_NAME: str = "TrakCare Offline"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
