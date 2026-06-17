"""Twilio WhatsApp REST client wrapper.

Stub-safe (same pattern as integrations/vapi.py): when no Twilio credentials
are available, every method logs the call and returns a benign placeholder so
the rest of the app keeps working without WhatsApp. When credentials are
passed (per-location, from the DB) real HTTP calls go to Twilio's REST API.

The Twilio WhatsApp API needs no SDK — it's a plain form-encoded POST to the
Messages resource, with HTTP Basic auth (account_sid:auth_token).
"""

from __future__ import annotations

import base64
import hashlib
import hmac

import httpx

from app.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)

_TWILIO_API_BASE = "https://api.twilio.com/2010-04-01"


def is_configured() -> bool:
    """True if a global Twilio fallback is set in env. Per-location configs
    live in the DB and are passed explicitly, so WhatsApp can work even when
    this returns False — this only reflects the env-level fallback."""
    settings = get_settings()
    return bool(settings.twilio_account_sid and settings.twilio_auth_token)


def _normalize_whatsapp(number: str) -> str:
    """Ensure the address carries the `whatsapp:` channel prefix Twilio wants."""
    number = number.strip()
    if number.startswith("whatsapp:"):
        return number
    return f"whatsapp:{number}"


def send_whatsapp_message(
    *,
    to: str,
    from_: str,
    body: str,
    account_sid: str,
    auth_token: str,
) -> None:
    """POST a WhatsApp message via Twilio's Messages resource.

    `to` / `from_` are plain E.164 numbers (e.g. +14155551234); we add the
    `whatsapp:` prefix. In stub mode (missing credentials) we just log."""
    if not account_sid or not auth_token:
        log.info(
            "twilio_whatsapp_stub_send",
            to=to,
            from_=from_,
            body_preview=body[:80],
        )
        return

    url = f"{_TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json"
    form = {
        "To": _normalize_whatsapp(to),
        "From": _normalize_whatsapp(from_),
        "Body": body,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(url, data=form, auth=(account_sid, auth_token))
        if not res.is_success:
            try:
                detail = res.json()
            except Exception:
                detail = res.text
            log.error(
                "twilio_whatsapp_send_failed",
                status=res.status_code,
                detail=detail,
            )
    except Exception as exc:
        # Never let a Twilio failure bubble into the webhook — the caller
        # already returned 200 to Twilio; this is fire-and-forget delivery.
        log.error("twilio_whatsapp_send_error", error=str(exc))


def send_sms_message(
    *,
    to: str,
    from_: str,
    body: str,
    account_sid: str,
    auth_token: str,
) -> None:
    """POST a plain SMS via Twilio's Messages resource.

    Identical to send_whatsapp_message but `to`/`from_` are plain E.164
    numbers with no `whatsapp:` prefix. Stub-safe: logs when credentials or
    sender are missing."""
    if not account_sid or not auth_token or not from_:
        log.info(
            "twilio_sms_stub_send",
            to=to,
            from_=from_,
            body_preview=body[:80],
        )
        return

    url = f"{_TWILIO_API_BASE}/Accounts/{account_sid}/Messages.json"
    form = {
        "To": to.strip(),
        "From": from_.strip(),
        "Body": body,
    }
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(url, data=form, auth=(account_sid, auth_token))
        if not res.is_success:
            try:
                detail = res.json()
            except Exception:
                detail = res.text
            log.error("twilio_sms_send_failed", status=res.status_code, detail=detail)
    except Exception as exc:
        log.error("twilio_sms_send_error", error=str(exc))


def verify_twilio_signature(
    *,
    url: str,
    params: dict[str, str],
    signature: str | None,
    auth_token: str | None,
) -> bool:
    """Validate Twilio's X-Twilio-Signature header.

    Twilio computes HMAC-SHA1 over the full request URL with the POST params
    appended as sorted `key+value` pairs, keyed by your auth token, then
    base64-encodes it. We recompute and constant-time compare.

    Returns True (log a warning) when no auth token is configured — dev
    convenience so local/sandbox testing isn't blocked. In production every
    configured location has a token, so this enforces in practice.
    """
    if not auth_token:
        log.warning("twilio_whatsapp_signature_skipped_no_token")
        return True
    if not signature:
        log.warning("twilio_whatsapp_signature_missing_header")
        return False

    data = url
    for key in sorted(params.keys()):
        data += key + (params[key] if params[key] is not None else "")

    digest = hmac.new(auth_token.encode("utf-8"), data.encode("utf-8"), hashlib.sha1).digest()
    expected = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(expected, signature)
