"""Send a WhatsApp/SMS confirmation to the customer after an order is placed.

Best-effort and fire-and-forget: every path is wrapped so a failure here can
never break the order flow. Prefers WhatsApp via the location's Twilio config;
falls back to SMS via global Twilio credentials; otherwise logs and returns.

We do NOT persist sent confirmations in V2 — structured logs are enough
(persistence is a V3 item).
"""

from typing import Any

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import twilio_whatsapp

log = get_logger(__name__)

_FULFILLMENT_TEXT = {"pickup": "pickup", "delivery": "delivery", "dine_in": "dine-in"}


def _build_confirmation(
    name: str | None,
    items: list[dict],
    total_cents: int,
    fulfillment: str,
    order_id: str,
    currency: str | None,
) -> str:
    greeting = f"Hi {name}! " if name else "Hi! "
    item_lines: list[str] = []
    for item in items[:5]:  # max 5 lines — keep SMS short
        qty = item.get("quantity", 1)
        item_name = item.get("name", "Item")
        item_lines.append(f"  • {qty}x {item_name}")
    if len(items) > 5:
        item_lines.append(f"  • ...and {len(items) - 5} more")
    items_text = "\n".join(item_lines)
    from app.core.currency import format_cents

    total = format_cents(total_cents, currency)
    fulfillment_text = _FULFILLMENT_TEXT.get(fulfillment, fulfillment)
    ref = order_id[:8].upper()

    return (
        f"{greeting}Your VOAS order is confirmed! 🎉\n\n"
        f"{items_text}\n\n"
        f"Total: {total} ({fulfillment_text})\n"
        f"Ref: #{ref}\n\n"
        f"We'll have it ready soon. Thank you!"
    )


def _location_whatsapp_config(workspace_id: str, location_id: str | None) -> dict[str, Any] | None:
    if not location_id:
        return None
    db = get_supabase_admin()
    res = (
        db.table("location_whatsapp_config")
        .select("twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, enabled")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _confirmations_enabled(workspace_id: str) -> bool:
    db = get_supabase_admin()
    res = (
        db.table("voice_settings")
        .select("send_order_confirmations")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    return not (res.data and not res.data[0].get("send_order_confirmations", True))


def send_order_confirmation(
    *,
    workspace_id: str,
    location_id: str | None,
    customer_phone: str | None,
    customer_name: str | None,
    order_id: str,
    items_json: list[dict],
    total_cents: int,
    fulfillment: str,
) -> None:
    """Send the order confirmation. Never raises — logs and returns on any issue."""
    try:
        if not customer_phone:
            log.info("order_confirmation_skipped_no_phone", order_id=order_id)
            return

        if not _confirmations_enabled(workspace_id):
            log.info("order_confirmation_disabled", workspace_id=workspace_id)
            return

        db = get_supabase_admin()
        ws = db.table("workspaces").select("currency").eq("id", workspace_id).limit(1).execute()
        currency = (ws.data[0].get("currency") if ws.data else None)

        message = _build_confirmation(
            customer_name, items_json, total_cents, fulfillment, order_id, currency
        )

        # 1. Prefer WhatsApp via the location's own Twilio config.
        config = _location_whatsapp_config(workspace_id, location_id)
        if config and config.get("twilio_account_sid") and config.get("twilio_auth_token"):
            twilio_whatsapp.send_whatsapp_message(
                to=customer_phone,
                from_=config["twilio_whatsapp_number"],
                body=message,
                account_sid=config["twilio_account_sid"],
                auth_token=config["twilio_auth_token"],
            )
            log.info(
                "order_confirmation_sent",
                order_id=order_id,
                channel="whatsapp",
            )
            return

        # 2. Fall back to SMS via global Twilio credentials.
        settings = get_settings()
        if (
            settings.twilio_account_sid
            and settings.twilio_auth_token
            and settings.twilio_sms_from_number
        ):
            twilio_whatsapp.send_sms_message(
                to=customer_phone,
                from_=settings.twilio_sms_from_number,
                body=message,
                account_sid=settings.twilio_account_sid,
                auth_token=settings.twilio_auth_token,
            )
            log.info("order_confirmation_sent", order_id=order_id, channel="sms")
            return

        # 3. Nothing configured — stub mode, no crash.
        log.info("order_confirmation_skipped", order_id=order_id, reason="no_transport")
    except Exception as exc:
        log.error("order_confirmation_error", order_id=order_id, error=str(exc))
