from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

IST = ZoneInfo("Asia/Kolkata")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://dealer:dealer@localhost:5433/dealer"
    jwt_secret: str
    jwt_ttl_minutes: int = 12 * 60
    cookie_secure: bool = False
    cors_origins: list[str] = ["http://localhost:5173"]
    public_site_url: str = "http://localhost:5173"

    groq_api_key: str | None = None
    groq_model: str = "qwen/qwen3.8-27b"
    ai_timeout_seconds: float = 8.0

    lead_sla_minutes: int = 5
    slot_minutes: int = 60
    booking_lead_time_minutes: int = 120
    booking_window_days: int = 14

    @field_validator("database_url")
    @classmethod
    def use_asyncpg(cls, url: str) -> str:
        # Render and most hosts hand out postgres:// URLs.
        for prefix in ("postgres://", "postgresql://"):
            if url.startswith(prefix):
                return "postgresql+asyncpg://" + url.removeprefix(prefix)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
