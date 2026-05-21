from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    environment: Literal["development", "staging", "production"] = "development"
    log_level: str = "INFO"

    supabase_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_anon_key: str | None = None

    database_url: str | None = None

    cors_origins: str = "http://localhost:3001"

    sentry_dsn: str | None = None

    resend_api_key: str | None = None
    email_from: str = "no-reply@voas.ai"

    rate_limit_global_per_hour: int = Field(default=1000, ge=1)
    rate_limit_writes_per_minute: int = Field(default=100, ge=1)

    # --- Vapi (voice AI). V2 Sprint 2+; no-op without these. ---
    vapi_api_key: str | None = None
    vapi_public_key: str | None = None       # exposed to the browser for web SDK test calls
    vapi_webhook_secret: str | None = None
    vapi_server_url: str | None = None       # public URL Vapi posts events to (e.g. https://abc.ngrok.io)
    vapi_base_url: str = "https://api.vapi.ai"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
