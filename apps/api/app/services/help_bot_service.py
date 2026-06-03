"""Dashboard in-app help bot powered by Google Gemini.

Answers product/how-to questions for workspace users. Uses a static guide
(docs/help-bot-context.md) plus live workspace hints (locations, voice, etc.).
Stub-safe when GEMINI_API_KEY is unset.
"""

from __future__ import annotations

import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.help import HelpChatRequest, HelpChatReply, HelpChatTurn

log = get_logger(__name__)

_GEMINI_TIMEOUT = 20.0
_RATE_LIMIT_PER_HOUR = 30
_FALLBACK_REPLY = (
    "Sorry, I'm having trouble right now. Try again in a moment, or open "
    "Support from the sidebar for help from our team."
)
_STUB_REPLY = (
    "The help assistant isn't configured yet (missing GEMINI_API_KEY). "
    "Browse Integrations for voice/WhatsApp setup, or open Support (/support)."
)

# user_id → list of unix timestamps (best-effort; single-worker MVP)
_rate_buckets: dict[str, list[float]] = defaultdict(list)

_CONTEXT_PATH = Path(__file__).resolve().parent.parent / "data" / "help_bot_context.md"


def _load_product_guide() -> str:
    try:
        return _CONTEXT_PATH.read_text(encoding="utf-8").strip()
    except OSError:
        log.warning("help_bot_context_missing", path=str(_CONTEXT_PATH))
        return "You are the VOAS AI dashboard help assistant."


def _rate_limit_ok(user_id: str) -> bool:
    now = time.time()
    window_start = now - 3600
    hits = [t for t in _rate_buckets[user_id] if t >= window_start]
    _rate_buckets[user_id] = hits
    if len(hits) >= _RATE_LIMIT_PER_HOUR:
        return False
    _rate_buckets[user_id].append(now)
    return True


def _workspace_hints(workspace_id: str) -> str:
    db = get_supabase_admin()
    hints: list[str] = []

    loc_res = (
        db.table("locations")
        .select("id")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    loc_count = len(loc_res.data or [])
    hints.append(f"Locations configured: {loc_count}")

    voice_res = (
        db.table("voice_settings")
        .select("vapi_assistant_id, enabled, send_order_confirmations")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if voice_res.data:
        row = voice_res.data[0]
        hints.append(
            f"Voice agent: {'enabled' if row.get('enabled') else 'disabled'}, "
            f"Vapi synced: {'yes' if row.get('vapi_assistant_id') else 'no'}"
        )

    wa_res = (
        db.table("whatsapp_settings")
        .select("enabled")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if wa_res.data:
        hints.append(
            f"WhatsApp workspace setting enabled: {bool(wa_res.data[0].get('enabled'))}"
        )

    cat_res = (
        db.table("menu_categories")
        .select("id")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    cat_count = len(cat_res.data or [])
    hints.append(f"Menu categories: {cat_count}")

    return "\n".join(hints)


def _build_system_prompt(workspace_id: str, page_path: str) -> str:
    guide = _load_product_guide()
    hints = _workspace_hints(workspace_id)
    return (
        f"{guide}\n\n"
        f"---\n"
        f"Current page path: {page_path}\n"
        f"Workspace context:\n{hints}\n"
        f"Answer only about using VOAS AI. Be concise and actionable."
    )


def _to_gemini_contents(
    history: list[HelpChatTurn], message: str
) -> list[dict[str, Any]]:
    contents: list[dict[str, Any]] = []
    for turn in history:
        role = "user" if turn.role == "user" else "model"
        contents.append({"role": role, "parts": [{"text": turn.content}]})
    contents.append({"role": "user", "parts": [{"text": message}]})
    return contents


def _call_gemini(system_prompt: str, contents: list[dict[str, Any]]) -> str | None:
    settings = get_settings()
    if not settings.gemini_api_key:
        log.info("help_bot_gemini_stub")
        return _STUB_REPLY

    model = settings.gemini_model
    url = (
        f"{settings.gemini_base_url.rstrip('/')}/models/{model}:generateContent"
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
    }
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.gemini_api_key,
    }
    try:
        with httpx.Client(timeout=_GEMINI_TIMEOUT) as client:
            res = client.post(url, json=payload, headers=headers)
        if not res.is_success:
            try:
                detail = res.json()
            except Exception:  # noqa: BLE001
                detail = res.text
            log.error("help_bot_gemini_failed", status=res.status_code, detail=detail)
            return None
        data = res.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return None
        parts = (candidates[0].get("content") or {}).get("parts") or []
        texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
        reply = "".join(texts).strip()
        return reply or None
    except Exception as exc:  # noqa: BLE001
        log.error("help_bot_gemini_error", error=str(exc))
        return None


def chat(
    workspace_id: str,
    user_id: str,
    payload: HelpChatRequest,
) -> HelpChatReply:
    if not _rate_limit_ok(user_id):
        return HelpChatReply(
            reply="You've sent a lot of messages — please wait a few minutes and try again."
        )

    system_prompt = _build_system_prompt(workspace_id, payload.page_path.strip() or "/dashboard")
    contents = _to_gemini_contents(payload.history, payload.message.strip())
    reply = _call_gemini(system_prompt, contents)
    if reply is None:
        reply = _FALLBACK_REPLY

    log.info(
        "help_bot_reply",
        workspace_id=workspace_id,
        user_id=user_id,
        page_path=payload.page_path,
    )
    return HelpChatReply(reply=reply)
