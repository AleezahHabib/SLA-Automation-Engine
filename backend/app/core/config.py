import re
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Project metadata
    PROJECT_NAME: str = "SLA Automation Engine"
    API_V1_STR: str = "/api/v1"

    # Database
    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")

    # JWT Authentication
    JWT_SECRET: str = Field(..., min_length=32, description="Secret key for JWT token signing")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 12

    # CORS
    ALLOWED_ORIGINS: str = Field("http://localhost:3000,http://127.0.0.1:3000,https://*.vercel.app", description="Comma-separated allowed origins")
    ALLOWED_ORIGIN_REGEX: Optional[str] = Field(None, description="Anchored regex for preview deployment origins")

    # SLA Worker
    SLA_WORKER_ENABLED: bool = True
    SLA_WORKER_INTERVAL_SECONDS: int = 60

    # Attachments
    MAX_UPLOAD_BYTES: int = 5 * 1024 * 1024  # 5 MB
    MAX_ATTACHMENTS_PER_TICKET: int = 10
    MAX_TOTAL_ATTACHMENT_BYTES_PER_TICKET: int = 20 * 1024 * 1024  # 20 MB

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        elif url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
        return url

    @property
    def allowed_origins_list(self) -> List[str]:
        if isinstance(self.ALLOWED_ORIGINS, list):
            return self.ALLOWED_ORIGINS
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    @field_validator("ALLOWED_ORIGIN_REGEX")
    @classmethod
    def validate_origin_regex(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v != "":
            # Ensure anchored at both ends per spec 16 R6
            if not v.startswith("^") or not v.endswith("$"):
                raise ValueError("ALLOWED_ORIGIN_REGEX must be anchored with ^ at start and $ at end")
            try:
                re.compile(v)
            except re.error as e:
                raise ValueError(f"Invalid ALLOWED_ORIGIN_REGEX pattern: {e}")
        return v


settings = Settings()

