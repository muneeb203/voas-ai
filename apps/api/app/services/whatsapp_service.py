"""WhatsApp settings + per-location Twilio config.

Mirrors voice_service for the WhatsApp channel. The webhook reads Twilio
credentials from location_whatsapp_config at message time (never from env),
and the AI personality from whatsapp_settings.
"""

from datetime import datetime, timezone

from app.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import twilio_whatsapp
from app.models.voice import DEFAULT_SYSTEM_PROMPT
from app.models.whatsapp import (
    AVAILABLE_MODELS,
    DEFAULT_GREETING,
    LocationWhatsAppConfig,
    LocationWhatsAppConfigSafe,
    LocationWhatsAppConfigUpsert,
    WhatsAppCapabilities,
    WhatsAppSettings,
    WhatsAppSettingsUpdate,
)
from app.services import audit_service

log = get_logger(__name__)


def _mask_token(token: str) -> str:
    if len(token) <= 8:
        return "•" * len(token)
    return f"{token[:4]}{'•' * 8}{token[-4:]}"


def get_capabilities() -> WhatsAppCapabilities:
    settings = get_settings()
    return WhatsAppCapabilities(
        models=AVAILABLE_MODELS,
        openai_configured=bool(settings.openai_api_key),
        twilio_configured=twilio_whatsapp.is_configured(),
        sandbox_number=settings.twilio_whatsapp_sandbox_number,
    )


# --- Workspace WhatsApp settings -------------------------------------------


def _seed_system_prompt(workspace_id: str) -> str:
    """Reuse the workspace's voice system prompt as the WhatsApp starting
    point when one exists, so owners don't re-author the agent. Falls back to
    the shared restaurant default."""
    db = get_supabase_admin()
    res = (
        db.table("voice_settings")
        .select("system_prompt")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if res.data and (res.data[0].get("system_prompt") or "").strip():
        return res.data[0]["system_prompt"]
    return DEFAULT_SYSTEM_PROMPT


def get_or_create_settings(workspace_id: str) -> WhatsAppSettings:
    db = get_supabase_admin()
    res = (
        db.table("whatsapp_settings")
        .select("*")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return WhatsAppSettings.model_validate(res.data[0])

    res = (
        db.table("whatsapp_settings")
        .insert(
            {
                "workspace_id": workspace_id,
                "system_prompt": _seed_system_prompt(workspace_id),
                "greeting": DEFAULT_GREETING,
                "model": "gpt-4o-mini",
                "enabled": False,
                "session_window_hours": 24,
            }
        )
        .execute()
    )
    if not res.data:
        raise AppError("Could not initialize WhatsApp settings")
    return WhatsAppSettings.model_validate(res.data[0])


def update_settings(
    workspace_id: str, payload: WhatsAppSettingsUpdate, actor_id: str
) -> WhatsAppSettings:
    current = get_or_create_settings(workspace_id)
    db = get_supabase_admin()

    changes = payload.model_dump(exclude_none=True)
    if changes:
        res = (
            db.table("whatsapp_settings")
            .update(changes)
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if not res.data:
            raise AppError("Could not update WhatsApp settings")
        current = WhatsAppSettings.model_validate(res.data[0])

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="whatsapp.settings_updated",
        resource_type="whatsapp_settings",
        resource_id=workspace_id,
        metadata={"changed_fields": list(changes.keys())},
    )
    return current


# --- Per-location Twilio WhatsApp config -----------------------------------


def _to_safe(row: dict) -> LocationWhatsAppConfigSafe:
    return LocationWhatsAppConfigSafe(
        location_id=row["location_id"],
        workspace_id=row["workspace_id"],
        twilio_account_sid=row["twilio_account_sid"],
        twilio_auth_token_masked=_mask_token(row["twilio_auth_token"]),
        twilio_whatsapp_number=row["twilio_whatsapp_number"],
        enabled=row["enabled"],
        last_synced_at=row.get("last_synced_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def get_location_config(
    workspace_id: str, location_id: str
) -> LocationWhatsAppConfigSafe | None:
    db = get_supabase_admin()
    res = (
        db.table("location_whatsapp_config")
        .select("*")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return _to_safe(res.data[0])


def upsert_location_config(
    workspace_id: str,
    location_id: str,
    payload: LocationWhatsAppConfigUpsert,
    actor_id: str,
) -> LocationWhatsAppConfigSafe:
    db = get_supabase_admin()
    existing = (
        db.table("location_whatsapp_config")
        .select("*")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    row = {
        "location_id": location_id,
        "workspace_id": workspace_id,
        "twilio_account_sid": payload.twilio_account_sid,
        "twilio_auth_token": payload.twilio_auth_token,
        "twilio_whatsapp_number": payload.twilio_whatsapp_number,
        "enabled": payload.enabled,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing.data:
        res = (
            db.table("location_whatsapp_config")
            .update(row)
            .eq("location_id", location_id)
            .execute()
        )
    else:
        res = db.table("location_whatsapp_config").insert(row).execute()
    if not res.data:
        raise AppError("Could not save location WhatsApp config")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="whatsapp.location_configured",
        resource_type="location",
        resource_id=location_id,
        metadata={
            "whatsapp_number": payload.twilio_whatsapp_number,
            "enabled": payload.enabled,
        },
    )
    return _to_safe(res.data[0])


def disable_location_config(workspace_id: str, location_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    existing = (
        db.table("location_whatsapp_config")
        .select("location_id")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        return

    db.table("location_whatsapp_config").delete().eq(
        "location_id", location_id
    ).eq("workspace_id", workspace_id).execute()

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="whatsapp.location_disabled",
        resource_type="location",
        resource_id=location_id,
    )


# --- Webhook lookups (internal, plain token) -------------------------------


def find_location_by_whatsapp_number(phone: str) -> tuple[str, str] | None:
    """Resolve which workspace + location owns an inbound WhatsApp number.

    `phone` is the plain E.164 number (no `whatsapp:` prefix)."""
    db = get_supabase_admin()
    res = (
        db.table("location_whatsapp_config")
        .select("workspace_id, location_id")
        .eq("twilio_whatsapp_number", phone)
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return (res.data[0]["workspace_id"], res.data[0]["location_id"])


def get_location_config_internal(location_id: str) -> LocationWhatsAppConfig | None:
    """Full config including the plain auth token — webhook use only."""
    db = get_supabase_admin()
    res = (
        db.table("location_whatsapp_config")
        .select("*")
        .eq("location_id", location_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return LocationWhatsAppConfig.model_validate(res.data[0])
