"""Generate the AI reply for an inbound WhatsApp message.

Unlike voice (where Vapi runs the LLM loop), WhatsApp turns are stateless
HTTP: Twilio posts a message, we call OpenAI once, send the reply back.

Order capture uses an inline marker protocol instead of function calling —
the model is told to emit a JSON block wrapped in <<<ORDER>>> … <<<END_ORDER>>>
when (and only when) the customer confirms a complete order. We parse that
block out, place the order via the existing voice_order_service, and strip
the block from the text the customer sees.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.whatsapp import WHATSAPP_PROMPT_SUFFIX
from app.services import voice_order_service, voice_service, whatsapp_service

log = get_logger(__name__)

_HISTORY_LIMIT = 20
_OPENAI_TIMEOUT = 9.0  # keep under Twilio's webhook patience (~10s)
_FALLBACK_REPLY = (
    "Sorry, I'm having trouble right now. Please call us or try again in a moment."
)

_ORDER_BLOCK_RE = re.compile(
    r"<<<ORDER>>>\s*(?P<json>.*?)\s*<<<END_ORDER>>>",
    re.DOTALL,
)


def _strip_order_block(text: str) -> str:
    """Remove the <<<ORDER>>> … <<<END_ORDER>>> block from the customer-facing
    reply, then tidy whitespace."""
    cleaned = _ORDER_BLOCK_RE.sub("", text)
    return cleaned.strip()


def _extract_order(text: str) -> dict[str, Any] | None:
    """Pull the order JSON out of the marker block, if present and valid."""
    match = _ORDER_BLOCK_RE.search(text)
    if not match:
        return None
    raw = match.group("json").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("whatsapp_order_block_invalid_json", raw_preview=raw[:200])
        return None
    return parsed if isinstance(parsed, dict) else None


def _build_system_prompt(workspace_id: str, base_prompt: str) -> str:
    menu_md = voice_service._menu_context_for_workspace(workspace_id)
    parts = [base_prompt.strip(), WHATSAPP_PROMPT_SUFFIX.strip()]
    if menu_md:
        parts.append(menu_md)
    return "\n\n".join(p for p in parts if p)


def _load_history(conversation_id: str) -> list[dict[str, str]]:
    """Last N messages for this conversation, oldest first, mapped to the
    OpenAI chat roles (customer → user, agent → assistant)."""
    db = get_supabase_admin()
    res = (
        db.table("conversation_messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=True)
        .limit(_HISTORY_LIMIT)
        .execute()
    )
    rows = list(reversed(res.data or []))
    messages: list[dict[str, str]] = []
    for row in rows:
        role = row.get("role")
        content = row.get("content") or ""
        if not content:
            continue
        if role == "customer":
            messages.append({"role": "user", "content": content})
        elif role == "agent":
            messages.append({"role": "assistant", "content": content})
        # 'system' rows are internal notes — skip from the model context.
    return messages


def _call_openai(
    model: str, messages: list[dict[str, str]]
) -> tuple[str | None, dict[str, int] | None]:
    """Single OpenAI chat completion. Returns (assistant text, token usage)."""
    settings = get_settings()
    if not settings.openai_api_key:
        log.info("whatsapp_openai_stub", model=model, turns=len(messages))
        return (
            "Thanks for your message! Our AI assistant isn't fully set up yet, "
            "but someone from our team will follow up shortly.",
            None,
        )

    url = f"{settings.openai_base_url}/chat/completions"
    payload = {"model": model, "messages": messages, "temperature": 0.4}
    headers = {
        "Authorization": f"Bearer {settings.openai_api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=_OPENAI_TIMEOUT) as client:
            res = client.post(url, json=payload, headers=headers)
        if not res.is_success:
            try:
                detail = res.json()
            except Exception:  # noqa: BLE001
                detail = res.text
            log.error("whatsapp_openai_failed", status=res.status_code, detail=detail)
            return None, None
        data = res.json()
        choices = data.get("choices") or []
        if not choices:
            return None, None
        text = (choices[0].get("message") or {}).get("content")
        usage_raw = data.get("usage") or {}
        usage: dict[str, int] | None = None
        if usage_raw:
            usage = {
                "prompt_tokens": int(usage_raw.get("prompt_tokens") or 0),
                "completion_tokens": int(usage_raw.get("completion_tokens") or 0),
                "total_tokens": int(usage_raw.get("total_tokens") or 0),
            }
        return text, usage
    except Exception as exc:  # noqa: BLE001
        log.error("whatsapp_openai_error", error=str(exc))
        return None, None


def get_ai_reply(
    workspace_id: str,
    conversation_id: str,
    incoming_message: str,
) -> dict[str, Any]:
    """Run one AI turn for a WhatsApp message.

    Returns {"reply": str, "order_placed": bool, "order_id": str | None}.
    The reply is already stripped of any order marker block, safe to send
    straight to the customer."""
    settings_row = whatsapp_service.get_or_create_settings(workspace_id)
    db = get_supabase_admin()

    conv_res = (
        db.table("conversations")
        .select("id, location_id, customer_id, customer_phone")
        .eq("id", conversation_id)
        .limit(1)
        .execute()
    )
    conv = conv_res.data[0] if conv_res.data else {}

    system_prompt = _build_system_prompt(workspace_id, settings_row.system_prompt)
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages.extend(_load_history(conversation_id))
    messages.append({"role": "user", "content": incoming_message})

    raw_reply, token_usage = _call_openai(settings_row.model, messages)
    if raw_reply is None:
        return {"reply": _FALLBACK_REPLY, "order_placed": False, "order_id": None, "usage": None}

    order_args = _extract_order(raw_reply)
    customer_reply = _strip_order_block(raw_reply) or "Got it!"

    order_placed = False
    order_id: str | None = None
    if order_args:
        try:
            result = voice_order_service.place_order_from_tool_call(
                workspace_id=workspace_id,
                location_id=conv.get("location_id"),
                conversation_id=conversation_id,
                customer_id=conv.get("customer_id"),
                customer_phone=order_args.get("customer_phone")
                or conv.get("customer_phone"),
                arguments=order_args,
            )
            order_placed = bool(result.get("success"))
            order_id = result.get("order_id")
            if not order_placed and result.get("message"):
                # Surface the failure reason to the customer rather than a
                # silent drop (e.g. "couldn't capture any items").
                customer_reply = f"{customer_reply}\n\n{result['message']}".strip()
        except Exception as exc:  # noqa: BLE001
            log.error(
                "whatsapp_order_place_failed",
                workspace_id=workspace_id,
                conversation_id=conversation_id,
                error=str(exc),
            )

    return {
        "reply": customer_reply,
        "order_placed": order_placed,
        "order_id": order_id,
        "usage": token_usage,
    }
