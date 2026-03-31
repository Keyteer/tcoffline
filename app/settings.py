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

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
