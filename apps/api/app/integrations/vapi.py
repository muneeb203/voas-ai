"""Vapi REST client wrapper.

Stub-safe: when VAPI_API_KEY isn't set, every method logs the call and
returns a benign placeholder so the rest of the app keeps working without
voice. When the key is set, real HTTP calls go to https://api.vapi.ai.

This is intentionally minimal — we only call the endpoints V2 Sprint 2
needs (assistants + phone-numbers). When V2 Sprint 3 adds WhatsApp via
a different provider we'll add a sibling integrations/twilio.py etc.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx

from app.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class VapiNotConfigured(Exception):
    pass


def is_configured() -> bool:
    return bool(get_settings().vapi_api_key)


def _client() -> httpx.Client:
    settings = get_settings()
    if not settings.vapi_api_key:
        raise VapiNotConfigured("VAPI_API_KEY is not set")
    return httpx.Client(
        base_url=settings.vapi_base_url,
        headers={
            "Authorization": f"Bearer {settings.vapi_api_key}",
            "Content-Type": "application/json",
        },
        timeout=20.0,
    )


# ---------- Assistants ------------------------------------------------------


_VOICE_ID_MAP = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "antoni": "ErXwobaYiN019PkySvjV",
    "bella": "EXAVITQu4vr4xnSDxMaL",
    "domi": "AZnzlk1XvdvUeBnXmlld",
    "elli": "MF3mGyEYCl7XYWbV9V6O",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
}

# How each supported language maps to Deepgram (STT) + ElevenLabs (TTS)
# settings. Arabic + Urdu use ElevenLabs' multilingual model — the same voice
# ids (Rachel, Antoni, etc.) work; ElevenLabs adapts pronunciation. Deepgram
# "multi" mode handles Arabic/Urdu including English code-switching that's
# common in Pakistani / Gulf markets.
LANGUAGE_CONFIG: dict[str, dict[str, str]] = {
    "en": {
        "deepgram_language": "en",
        "deepgram_model": "nova-2",
        "elevenlabs_model": "eleven_turbo_v2_5",
    },
    "ar": {
        "deepgram_language": "multi",
        "deepgram_model": "nova-2",
        "elevenlabs_model": "eleven_multilingual_v2",
    },
    "ur": {
        "deepgram_language": "multi",
        "deepgram_model": "nova-2",
        "elevenlabs_model": "eleven_multilingual_v2",
    },
}


PLACE_ORDER_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "place_order",
        "description": (
            "Record a finalized order from the customer. ONLY call this after the "
            "customer has explicitly confirmed their full order including items, "
            "quantities, and any modifiers. Do NOT call before the customer says "
            "they're done or confirms the total."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "description": "List of items the customer is ordering.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Item name as it appears on the menu.",
                            },
                            "quantity": {
                                "type": "integer",
                                "description": "How many of this item.",
                                "minimum": 1,
                            },
                            "modifiers": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Modifier names chosen for this item, e.g. ['Large', 'Extra cheese'].",
                            },
                            "notes": {
                                "type": "string",
                                "description": "Special instructions for this item.",
                            },
                        },
                        "required": ["name", "quantity"],
                    },
                },
                "customer_name": {"type": "string"},
                "customer_phone": {
                    "type": "string",
                    "description": "Customer's phone number including country code.",
                },
                "fulfillment": {
                    "type": "string",
                    "enum": ["pickup", "delivery", "dine_in"],
                },
                "special_instructions": {
                    "type": "string",
                    "description": "Any overall instructions for the order.",
                },
            },
            "required": ["items"],
        },
    },
}


CHECK_AVAILABILITY_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "check_availability",
        "description": (
            "Look up REAL open appointment times for a service on a given date. "
            "Call this before offering any time — never invent times. Returns a "
            "list of open slots, each with a starts_at and staff_id to copy "
            "exactly into book_appointment."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "service_id": {
                    "type": "string",
                    "description": "Service id, copied exactly from the services list in your prompt.",
                },
                "date": {
                    "type": "string",
                    "description": "Date the customer wants, as YYYY-MM-DD.",
                },
            },
            "required": ["service_id", "date"],
        },
    },
}


BOOK_APPOINTMENT_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "book_appointment",
        "description": (
            "Book an appointment. ONLY call after the customer confirms a specific "
            "service and time that came back from check_availability. Copy "
            "service_id, starts_at, and staff_id EXACTLY from that result."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "service_id": {"type": "string", "description": "Copied exactly from availability."},
                "starts_at": {
                    "type": "string",
                    "description": "ISO 8601 UTC slot start, copied exactly from availability.",
                },
                "staff_id": {
                    "type": "string",
                    "description": "Copied exactly from the chosen slot, or omit to auto-assign.",
                },
                "customer_name": {"type": "string"},
                "customer_phone": {
                    "type": "string",
                    "description": "Customer's phone number including country code.",
                },
            },
            "required": ["service_id", "starts_at"],
        },
    },
}


CHECK_IN_TOOL: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "check_in",
        "description": "Check a customer in for their appointment today, found by their name.",
        "parameters": {
            "type": "object",
            "properties": {"customer_name": {"type": "string"}},
            "required": ["customer_name"],
        },
    },
}


def _tools_for_vertical(vertical: str) -> list[dict[str, Any]]:
    if vertical == "salon":
        return [CHECK_AVAILABILITY_TOOL, BOOK_APPOINTMENT_TOOL, CHECK_IN_TOOL]
    return [PLACE_ORDER_TOOL]


def assistant_payload(
    *,
    system_prompt: str,
    greeting: str,
    voice: str,
    model: str,
    server_url: str | None,
    end_call_phrases: list[str] | None = None,
    language: str = "en",
    vertical: str = "restaurant",
) -> dict[str, Any]:
    """Shape the JSON Vapi expects for create/update of an assistant."""
    voice_id = _VOICE_ID_MAP.get(voice.lower(), voice)
    lang_cfg = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["en"])

    payload: dict[str, Any] = {
        "name": "VOAS workspace agent",
        "firstMessage": greeting,
        "model": {
            "provider": "openai",
            "model": model,
            "messages": [{"role": "system", "content": system_prompt}],
            "tools": _tools_for_vertical(vertical),
        },
        "voice": {
            "provider": "11labs",
            "voiceId": voice_id,
            "model": lang_cfg["elevenlabs_model"],
        },
        # Vapi handles transcription + LLM + TTS in one round trip
        "transcriber": {
            "provider": "deepgram",
            "model": lang_cfg["deepgram_model"],
            "language": lang_cfg["deepgram_language"],
        },
        # End-of-call analysis. Vapi puts sentiment via structuredData,
        # not a dedicated sentimentPrompt field.
        "analysisPlan": {
            "summaryPrompt": (
                "Summarize this call in 1-2 sentences. What did the customer want, "
                "what did the agent do?"
            ),
            "structuredDataPrompt": ("Extract structured data from this call."),
            "structuredDataSchema": {
                "type": "object",
                "properties": {
                    "sentiment": {
                        "type": "number",
                        "description": "Customer sentiment from -1 (very upset) to 1 (very happy).",
                    },
                    "outcome": {
                        "type": "string",
                        "enum": [
                            "order_placed",
                            "question_answered",
                            "booking_made",
                            "escalated",
                            "no_resolution",
                        ],
                    },
                },
            },
        },
    }
    if server_url:
        payload["serverUrl"] = server_url
    if end_call_phrases:
        payload["endCallPhrases"] = end_call_phrases
    return payload


def _raise_with_body(res: httpx.Response, action: str) -> None:
    """Replace httpx's default raise_for_status so we surface Vapi's actual
    JSON error message instead of a bland HTTPStatusError."""
    if res.is_success:
        return
    try:
        body = res.json()
    except Exception:
        body = res.text
    log.error("vapi_request_failed", action=action, status=res.status_code, body=body)
    raise RuntimeError(f"Vapi {action} failed ({res.status_code}): {body}")


def create_assistant(payload: dict[str, Any]) -> str:
    """POST /assistant → returns the new assistant id."""
    if not is_configured():
        log.info("vapi_stub_create_assistant", payload_keys=list(payload.keys()))
        return f"stub-assistant-{hash(payload['firstMessage']) % 10_000_000}"
    import time

    t0 = time.monotonic()
    with _client() as c:
        res = c.post("/assistant", json=payload)
        log.info(
            "vapi_http_call",
            action="create_assistant",
            status=res.status_code,
            elapsed_ms=int((time.monotonic() - t0) * 1000),
        )
        _raise_with_body(res, "create_assistant")
        return res.json()["id"]


def update_assistant(assistant_id: str, payload: dict[str, Any]) -> None:
    """PATCH /assistant/{id}."""
    if not is_configured():
        log.info("vapi_stub_update_assistant", assistant_id=assistant_id)
        return
    import time

    t0 = time.monotonic()
    with _client() as c:
        res = c.patch(f"/assistant/{assistant_id}", json=payload)
        log.info(
            "vapi_http_call",
            action="update_assistant",
            status=res.status_code,
            elapsed_ms=int((time.monotonic() - t0) * 1000),
        )
        _raise_with_body(res, "update_assistant")


def delete_assistant(assistant_id: str) -> None:
    if not is_configured():
        log.info("vapi_stub_delete_assistant", assistant_id=assistant_id)
        return
    with _client() as c:
        res = c.delete(f"/assistant/{assistant_id}")
        if res.status_code not in (200, 204, 404):
            _raise_with_body(res, "delete_assistant")


# ---------- Active call control -------------------------------------------


def end_call(call_id: str) -> None:
    """Terminate an in-progress call via the Vapi REST API.

    Used for a hard cutoff when a workspace exhausts its voice credits.
    Safe to call on an already-ended call — Vapi returns 404, which we
    treat as success.
    """
    if not is_configured():
        log.info("vapi_stub_end_call", call_id=call_id)
        return
    import time

    t0 = time.monotonic()
    with _client() as c:
        res = c.delete(f"/call/{call_id}")
        log.info(
            "vapi_http_call",
            action="end_call",
            call_id=call_id,
            status=res.status_code,
            elapsed_ms=int((time.monotonic() - t0) * 1000),
        )
        # 404 = call already ended; treat as success so background retries
        # don't surface a noisy error.
        if res.status_code not in (200, 204, 404):
            _raise_with_body(res, "end_call")


# ---------- Phone numbers (BYO Twilio import) ------------------------------


def import_twilio_number(
    *,
    twilio_account_sid: str,
    twilio_auth_token: str,
    twilio_phone_number: str,
    assistant_id: str,
    name: str,
) -> str:
    """POST /phone-number to import a Twilio number under the workspace assistant.
    Returns the new Vapi phone-number id."""
    payload = {
        "provider": "twilio",
        "name": name,
        "twilioAccountSid": twilio_account_sid,
        "twilioAuthToken": twilio_auth_token,
        "number": twilio_phone_number,
        "assistantId": assistant_id,
    }
    if not is_configured():
        log.info("vapi_stub_import_phone", number=twilio_phone_number, assistant_id=assistant_id)
        return f"stub-phone-{hash(twilio_phone_number) % 10_000_000}"
    with _client() as c:
        res = c.post("/phone-number", json=payload)
        _raise_with_body(res, "import_twilio_number")
        return res.json()["id"]


def update_phone_number_assistant(phone_number_id: str, assistant_id: str) -> None:
    if not is_configured():
        log.info("vapi_stub_update_phone_assistant", phone_number_id=phone_number_id)
        return
    with _client() as c:
        res = c.patch(f"/phone-number/{phone_number_id}", json={"assistantId": assistant_id})
        _raise_with_body(res, "update_phone_number_assistant")


def delete_phone_number(phone_number_id: str) -> None:
    if not is_configured():
        log.info("vapi_stub_delete_phone", phone_number_id=phone_number_id)
        return
    with _client() as c:
        res = c.delete(f"/phone-number/{phone_number_id}")
        if res.status_code not in (200, 204, 404):
            _raise_with_body(res, "delete_phone_number")


# ---------- Webhook signature verification ---------------------------------


def verify_webhook(
    raw_body: bytes,
    *,
    shared_secret_header: str | None = None,
    signature_header: str | None = None,
) -> bool:
    """Verify a Vapi webhook. Vapi supports two schemes; we accept either:

    1. **Shared secret** (current default): Vapi sends `x-vapi-secret: <secret>`
       and we compare to our stored value (set in Vapi dashboard's "Server
       URL Secret" field).
    2. **HMAC SHA-256** (older): Vapi sends `x-vapi-signature: <hex>` which
       is the HMAC of the raw body using your secret.

    Returns True if either method matches, or if no secret is configured
    in our env (dev convenience — logs a warning so you know it's unverified).
    """
    settings = get_settings()
    secret = settings.vapi_webhook_secret
    if not secret:
        log.warning("vapi_webhook_signature_skipped_no_secret")
        return True

    # Vapi's current default: shared secret in the x-vapi-secret header.
    if shared_secret_header and hmac.compare_digest(shared_secret_header, secret):
        return True

    # Fallback for older Vapi setups: HMAC-SHA256 in x-vapi-signature.
    if signature_header:
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected, signature_header):
            return True

    return False


# Back-compat alias kept so the webhook router doesn't break mid-edit.
def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    return verify_webhook(raw_body, signature_header=signature_header)
