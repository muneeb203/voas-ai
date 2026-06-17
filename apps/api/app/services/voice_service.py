from datetime import UTC, datetime

from app.config import get_settings
from app.core.exceptions import AppError, NotFoundError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import vapi
from app.models.voice import (
    AVAILABLE_LANGUAGES,
    AVAILABLE_MODELS,
    AVAILABLE_VOICES,
    DEFAULT_GREETING,
    DEFAULT_GREETING_BY_LANG,
    DEFAULT_SYSTEM_PROMPT,
    DEFAULT_SYSTEM_PROMPT_BY_LANG,
    LocationVoiceConfigSafe,
    LocationVoiceConfigUpsert,
    VoiceCapabilities,
    VoiceSettings,
    VoiceSettingsUpdate,
)
from app.services import audit_service

log = get_logger(__name__)


def _mask_token(token: str) -> str:
    if len(token) <= 8:
        return "•" * len(token)
    return f"{token[:4]}{'•' * 8}{token[-4:]}"


def get_capabilities() -> VoiceCapabilities:
    settings = get_settings()
    return VoiceCapabilities(
        voices=AVAILABLE_VOICES,
        models=AVAILABLE_MODELS,
        languages=AVAILABLE_LANGUAGES,
        vapi_configured=vapi.is_configured(),
        vapi_public_key=settings.vapi_public_key,
    )


# --- Workspace voice settings ----------------------------------------------


def _last_menu_update(workspace_id: str) -> datetime | None:
    """Find the max updated_at across menu_categories + menu_items.

    Modifier groups + options inherit their timestamps via menu_items (any
    change to them bumps the parent item's updated_at? — not quite, so we
    also peek at them). Returns None if the workspace has no menu yet.
    """
    db = get_supabase_admin()
    candidates: list[datetime] = []

    cat = (
        db.table("menu_categories")
        .select("updated_at")
        .eq("workspace_id", workspace_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    if cat.data:
        candidates.append(_parse_dt(cat.data[0]["updated_at"]))

    items = (
        db.table("menu_items")
        .select("updated_at")
        .eq("workspace_id", workspace_id)
        .order("updated_at", desc=True)
        .limit(1)
        .execute()
    )
    if items.data:
        candidates.append(_parse_dt(items.data[0]["updated_at"]))

    return max(candidates) if candidates else None


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _hydrate_settings(row: dict, workspace_id: str) -> VoiceSettings:
    settings = VoiceSettings.model_validate(row)
    last_menu = _last_menu_update(workspace_id)
    settings.last_menu_update = last_menu
    if last_menu and (
        settings.last_synced_at is None or _parse_dt(settings.last_synced_at) < last_menu
    ):
        settings.menu_dirty = True
    return settings


def get_or_create_settings(workspace_id: str) -> VoiceSettings:
    db = get_supabase_admin()
    res = db.table("voice_settings").select("*").eq("workspace_id", workspace_id).limit(1).execute()
    if res.data:
        return _hydrate_settings(res.data[0], workspace_id)

    res = (
        db.table("voice_settings")
        .insert(
            {
                "workspace_id": workspace_id,
                "system_prompt": DEFAULT_SYSTEM_PROMPT,
                "greeting": DEFAULT_GREETING,
                "voice": "rachel",
                "model": "gpt-4o-mini",
                "enabled": False,
            }
        )
        .execute()
    )
    if not res.data:
        raise AppError("Could not initialize voice settings")
    return _hydrate_settings(res.data[0], workspace_id)


def _menu_context_for_workspace(workspace_id: str) -> str:
    """Render the workspace menu as a markdown snippet to feed Vapi.

    Lightweight: category → items with prices. Modifiers omitted at this
    layer (Sprint 4 POS sync handles deeper menu reasoning)."""
    db = get_supabase_admin()
    cats = (
        db.table("menu_categories")
        .select("id, name")
        .eq("workspace_id", workspace_id)
        .order("sort_order")
        .execute()
    )
    if not cats.data:
        return ""
    items_res = (
        db.table("menu_items")
        .select("category_id, name, price_cents")
        .eq("workspace_id", workspace_id)
        .eq("is_active", True)
        .order("sort_order")
        .execute()
    )
    by_cat: dict[str, list[dict]] = {}
    for row in items_res.data or []:
        by_cat.setdefault(row["category_id"], []).append(row)

    lines: list[str] = ["", "--- MENU ---"]
    for cat in cats.data:
        lines.append(f"\n## {cat['name']}")
        for item in by_cat.get(cat["id"], []):
            price = f"${item['price_cents'] / 100:.2f}"
            lines.append(f"- {item['name']} — {price}")
    return "\n".join(lines)


def _sync_assistant(workspace_id: str, settings: VoiceSettings) -> str | None:
    """Push the current settings (plus menu context) to Vapi.
    Returns the assistant id (creates if missing)."""
    cfg = get_settings()
    menu_md = _menu_context_for_workspace(workspace_id)
    full_prompt = f"{settings.system_prompt}\n\n{menu_md}".strip()

    payload = vapi.assistant_payload(
        system_prompt=full_prompt,
        greeting=settings.greeting,
        voice=settings.voice,
        model=settings.model,
        server_url=cfg.vapi_server_url,
        end_call_phrases=settings.end_call_phrases,
        language=settings.language,
    )

    if settings.vapi_assistant_id:
        vapi.update_assistant(settings.vapi_assistant_id, payload)
        return settings.vapi_assistant_id

    return vapi.create_assistant(payload)


def update_settings(
    workspace_id: str, payload: VoiceSettingsUpdate, actor_id: str
) -> VoiceSettings:
    import time

    t_start = time.monotonic()

    def _ms() -> int:
        return int((time.monotonic() - t_start) * 1000)

    log.info("voice_update_begin", workspace_id=workspace_id)
    current = get_or_create_settings(workspace_id)
    log.info("voice_update_step", step="get_or_create_settings", elapsed_ms=_ms())

    db = get_supabase_admin()

    changes = payload.model_dump(exclude_none=True)

    # If language is changing AND the prompt/greeting being submitted are
    # still the canned defaults from the previous language (i.e. owner never
    # customized them, just hit save), auto-swap to the target language's
    # defaults. This means "switch to Arabic" Just Works — the agent
    # immediately speaks Arabic — without forcing the owner to translate
    # the prompt by hand. If they've customized either string, we leave
    # their version alone.
    #
    # Important: the form always submits the textarea content, so we can't
    # rely on `"system_prompt" not in changes`. We instead compare the
    # SUBMITTED value (or current, if not submitted) against the old
    # language's defaults.
    new_lang = changes.get("language")
    if new_lang and new_lang != current.language:
        old_lang = current.language
        defaults_for_old_prompt = DEFAULT_SYSTEM_PROMPT_BY_LANG.get(old_lang, "")
        defaults_for_old_greet = DEFAULT_GREETING_BY_LANG.get(old_lang, "")
        submitted_prompt = changes.get("system_prompt", current.system_prompt) or ""
        submitted_greet = changes.get("greeting", current.greeting) or ""
        if submitted_prompt.strip() == defaults_for_old_prompt.strip():
            changes["system_prompt"] = DEFAULT_SYSTEM_PROMPT_BY_LANG[new_lang]
        if submitted_greet.strip() == defaults_for_old_greet.strip():
            changes["greeting"] = DEFAULT_GREETING_BY_LANG[new_lang]

    if changes:
        res = db.table("voice_settings").update(changes).eq("workspace_id", workspace_id).execute()
        if not res.data:
            raise NotFoundError("Voice settings not found")
        current = VoiceSettings.model_validate(res.data[0])
        log.info("voice_update_step", step="db_update_changes", elapsed_ms=_ms())

    # Sync to Vapi every time settings change (or first-time create assistant).
    try:
        assistant_id = _sync_assistant(workspace_id, current)
        log.info("voice_update_step", step="vapi_sync_assistant", elapsed_ms=_ms())
    except Exception as exc:
        log.error(
            "vapi_sync_failed",
            workspace_id=workspace_id,
            elapsed_ms=_ms(),
            error=str(exc),
        )
        raise AppError(f"Vapi rejected the assistant config: {exc}") from exc
    now_iso = datetime.now(UTC).isoformat()
    if assistant_id and assistant_id != current.vapi_assistant_id:
        update = (
            db.table("voice_settings")
            .update({"vapi_assistant_id": assistant_id, "last_synced_at": now_iso})
            .eq("workspace_id", workspace_id)
            .execute()
        )
        current = _hydrate_settings(update.data[0], workspace_id)
    else:
        res = (
            db.table("voice_settings")
            .update({"last_synced_at": now_iso})
            .eq("workspace_id", workspace_id)
            .execute()
        )
        if res.data:
            current = _hydrate_settings(res.data[0], workspace_id)

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="voice.settings_updated",
        resource_type="voice_settings",
        resource_id=workspace_id,
        metadata={"changed_fields": list(changes.keys())},
    )
    log.info("voice_update_done", workspace_id=workspace_id, total_ms=_ms())
    return current


# --- Per-location Twilio config --------------------------------------------


def _to_safe(row: dict) -> LocationVoiceConfigSafe:
    return LocationVoiceConfigSafe(
        location_id=row["location_id"],
        workspace_id=row["workspace_id"],
        twilio_account_sid=row["twilio_account_sid"],
        twilio_auth_token_masked=_mask_token(row["twilio_auth_token"]),
        twilio_phone_number=row["twilio_phone_number"],
        vapi_phone_number_id=row.get("vapi_phone_number_id"),
        enabled=row["enabled"],
        last_synced_at=row.get("last_synced_at"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def get_location_config(workspace_id: str, location_id: str) -> LocationVoiceConfigSafe | None:
    db = get_supabase_admin()
    res = (
        db.table("location_voice_config")
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
    payload: LocationVoiceConfigUpsert,
    location_name: str,
    actor_id: str,
) -> LocationVoiceConfigSafe:
    settings = get_or_create_settings(workspace_id)
    if not settings.vapi_assistant_id:
        # Force assistant creation first (without changing other settings).
        _ = update_settings(workspace_id, VoiceSettingsUpdate(), actor_id)
        settings = get_or_create_settings(workspace_id)
    if not settings.vapi_assistant_id:
        raise AppError("Voice assistant not ready — try saving settings first")

    db = get_supabase_admin()
    existing = (
        db.table("location_voice_config")
        .select("*")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    # Import the phone number into Vapi. If a previous import exists,
    # update its assistant assignment (handles edits). On stub mode this
    # is all no-ops returning placeholder ids.
    if existing.data and existing.data[0].get("vapi_phone_number_id"):
        vapi_phone_id = existing.data[0]["vapi_phone_number_id"]
        vapi.update_phone_number_assistant(vapi_phone_id, settings.vapi_assistant_id)
    else:
        vapi_phone_id = vapi.import_twilio_number(
            twilio_account_sid=payload.twilio_account_sid,
            twilio_auth_token=payload.twilio_auth_token,
            twilio_phone_number=payload.twilio_phone_number,
            assistant_id=settings.vapi_assistant_id,
            name=f"VOAS {location_name}",
        )

    row = {
        "location_id": location_id,
        "workspace_id": workspace_id,
        "twilio_account_sid": payload.twilio_account_sid,
        "twilio_auth_token": payload.twilio_auth_token,
        "twilio_phone_number": payload.twilio_phone_number,
        "vapi_phone_number_id": vapi_phone_id,
        "enabled": payload.enabled,
        "last_synced_at": datetime.now(UTC).isoformat(),
    }

    if existing.data:
        res = db.table("location_voice_config").update(row).eq("location_id", location_id).execute()
    else:
        res = db.table("location_voice_config").insert(row).execute()
    if not res.data:
        raise AppError("Could not save location voice config")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="voice.location_configured",
        resource_type="location",
        resource_id=location_id,
        metadata={"phone_number": payload.twilio_phone_number, "enabled": payload.enabled},
    )
    return _to_safe(res.data[0])


def disable_location_config(workspace_id: str, location_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    existing = (
        db.table("location_voice_config")
        .select("*")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        return

    if existing.data[0].get("vapi_phone_number_id"):
        try:
            vapi.delete_phone_number(existing.data[0]["vapi_phone_number_id"])
        except Exception as exc:
            log.warning("vapi_delete_phone_failed", error=str(exc))

    db.table("location_voice_config").delete().eq("location_id", location_id).execute()
    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="voice.location_disabled",
        resource_type="location",
        resource_id=location_id,
    )


# --- Webhook event processing ----------------------------------------------


def find_workspace_by_assistant(assistant_id: str) -> str | None:
    db = get_supabase_admin()
    res = (
        db.table("voice_settings")
        .select("workspace_id")
        .eq("vapi_assistant_id", assistant_id)
        .limit(1)
        .execute()
    )
    return res.data[0]["workspace_id"] if res.data else None


def find_location_by_phone_number_id(phone_number_id: str) -> tuple[str, str] | None:
    db = get_supabase_admin()
    res = (
        db.table("location_voice_config")
        .select("workspace_id, location_id")
        .eq("vapi_phone_number_id", phone_number_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return (res.data[0]["workspace_id"], res.data[0]["location_id"])
