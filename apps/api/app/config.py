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
    # Where "a customer replied on a ticket" alerts go. Unset = no alert sent.
    support_notification_email: str | None = None
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None

    rate_limit_enabled: bool = True
    rate_limit_global_per_hour: int = Field(default=1000, ge=1)
    rate_limit_writes_per_minute: int = Field(default=100, ge=1)

    # --- Vapi (voice AI). V2 Sprint 2+; no-op without these. ---
    vapi_api_key: str | None = None
    vapi_public_key: str | None = None  # exposed to the browser for web SDK test calls
    vapi_webhook_secret: str | None = None
    vapi_server_url: str | None = (
        None  # public URL Vapi posts events to (e.g. https://abc.ngrok.io)
    )
    vapi_base_url: str = "https://api.vapi.ai"

    # --- WhatsApp (Twilio + OpenAI). V2 Sprint 3+; no-op without these. ---
    openai_api_key: str | None = None  # generates WhatsApp AI replies
    openai_base_url: str = "https://api.openai.com/v1"
    twilio_account_sid: str | None = None  # global fallback; per-location overrides live in the DB
    twilio_auth_token: str | None = None  # global fallback
    twilio_sms_from_number: str | None = None  # E.164 sender for SMS confirmation fallback
    # Twilio's shared WhatsApp sandbox number — shown as a hint in the UI.
    twilio_whatsapp_sandbox_number: str = "+14155238886"

    # --- Free trial credits granted automatically on workspace creation. ---
    # Admin can raise/lower this per-workspace via the admin credit-grant panel.
    free_trial_voice_minutes: int = Field(default=10, ge=0)

    # --- Kiosk direct voice pipeline. No-op without these keys. ---
    # ANTHROPIC_API_KEY  → Claude Haiku for kiosk AI chat
    # OPENAI_API_KEY     → TTS via tts-1 (shared key with WhatsApp); falls back to browser TTS
    # OPENAI_TTS_VOICE   → alloy | echo | fable | onyx | nova | shimmer (default: nova)
    anthropic_api_key: str | None = None
    anthropic_base_url: str = "https://api.anthropic.com"
    openai_tts_voice: str = "nova"

    # --- Kiosk speech-to-text (Deepgram). No-op without the key; the kiosk
    # falls back to the free in-browser recognizer. ---
    deepgram_api_key: str | None = None
    deepgram_base_url: str = "https://api.deepgram.com"
    deepgram_model: str = "nova-2"

    # --- Google Calendar (salon two-way sync). No-op without these keys. ---
    # One OAuth app (created once by us) that all salons connect through.
    google_client_id: str | None = None
    google_client_secret: str | None = None
    # Where Google redirects after consent — must exactly match an Authorized
    # redirect URI in the Google Cloud OAuth client.
    google_oauth_redirect_uri: str = "http://localhost:8000/v1/google/oauth/callback"
    # Frontend page to bounce back to after connecting (fallback if the connect
    # request doesn't pass its own return URL).
    public_app_url: str = "http://localhost:3001"

    @property
    def google_calendar_configured(self) -> bool:
        return bool(self.google_client_id and self.google_client_secret)

    # --- Dashboard help bot (Gemini). No-op without GEMINI_API_KEY. ---
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.1-flash-lite"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
