"""Public (no-auth) webhook endpoints.

Vapi posts call events here. We verify the HMAC signature and then
update the conversations / conversation_messages tables accordingly.

Webhook event shapes are documented at https://docs.vapi.ai/server-url.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Header, Request, status
from fastapi.responses import Response

import json

from app.core.exceptions import ForbiddenError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import twilio_whatsapp, vapi
from app.services import (
    billing_service,
    customer_service,
    voice_order_service,
    voice_service,
    whatsapp_ai_service,
    whatsapp_service,
)
from app.models.customer import CustomerUpsert

_EMPTY_TWIML = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response/>"


def _twiml_ok() -> Response:
    """Twilio only needs a 200 with valid (possibly empty) TwiML. We send our
    reply proactively via the REST API, so the synchronous response is empty."""
    return Response(content=_EMPTY_TWIML, media_type="application/xml", status_code=200)


def _strip_whatsapp_prefix(value: str) -> str:
    return value[len("whatsapp:"):] if value.startswith("whatsapp:") else value

log = get_logger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _resolve_workspace(message: dict[str, Any]) -> tuple[str | None, str | None]:
    """Find which workspace + location an incoming Vapi event belongs to.

    Tries phone-number id first (most reliable for inbound calls), then
    assistant id (web SDK test calls don't have a phone number)."""
    phone_number = message.get("phoneNumber") or {}
    phone_id = phone_number.get("id") if isinstance(phone_number, dict) else None
    if phone_id:
        loc = voice_service.find_location_by_phone_number_id(phone_id)
        if loc:
            return loc

    assistant = message.get("assistant") or {}
    assistant_id = assistant.get("id") if isinstance(assistant, dict) else None
    if assistant_id:
        ws = voice_service.find_workspace_by_assistant(assistant_id)
        if ws:
            return (ws, None)

    return (None, None)


@router.post("/vapi", status_code=status.HTTP_200_OK)
async def vapi_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_vapi_secret: str | None = Header(default=None, alias="x-vapi-secret"),
    x_vapi_signature: str | None = Header(default=None, alias="x-vapi-signature"),
) -> dict[str, Any]:
    body = await request.body()
    if not vapi.verify_webhook(
        body,
        shared_secret_header=x_vapi_secret,
        signature_header=x_vapi_signature,
    ):
        log.warning(
            "vapi_webhook_bad_signature",
            has_secret_header=bool(x_vapi_secret),
            has_signature_header=bool(x_vapi_signature),
        )
        raise ForbiddenError("Invalid webhook signature")

    payload = await request.json()
    # Vapi nests the actual event under "message"
    message = payload.get("message") or payload
    event_type = message.get("type")

    workspace_id, location_id = _resolve_workspace(message)
    if not workspace_id:
        log.warning("vapi_webhook_unmatched", event_type=event_type)
        return {"status": "ignored"}

    db = get_supabase_admin()
    call = message.get("call") or {}
    call_id = call.get("id")

    log.info(
        "vapi_webhook_received",
        event_type=event_type,
        workspace_id=workspace_id,
        location_id=location_id,
        call_id=call_id,
    )

    if event_type == "status-update":
        status_val = message.get("status")
        if status_val == "in-progress" and call_id:
            if not billing_service.check_allowed(
                workspace_id, "voice_minutes", channel="voice"
            ):
                log.warning(
                    "vapi_voice_limit_reached",
                    workspace_id=workspace_id,
                    call_id=call_id,
                )
            _ensure_conversation(workspace_id, location_id, call, message)
        return {"status": "ok"}

    if event_type == "tool-calls":
        # Vapi assistant invoked one or more tools. We respond with a result
        # per tool call so the agent can read it back to the customer.
        tool_calls = message.get("toolCalls") or message.get("toolCallList") or []
        if not isinstance(tool_calls, list):
            tool_calls = []
        results: list[dict[str, Any]] = []

        conv = _ensure_conversation(workspace_id, location_id, call, message) if call_id else None

        for tc in tool_calls:
            tc_id = tc.get("id") or (tc.get("function") or {}).get("name", "tool")
            fn = tc.get("function") or {}
            name = fn.get("name") or tc.get("name") or ""
            raw_args = fn.get("arguments") or tc.get("arguments") or "{}"
            try:
                args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
            except json.JSONDecodeError:
                args = {}

            if name == "place_order":
                if not billing_service.check_allowed(
                    workspace_id, "voice_minutes", channel="voice"
                ):
                    results.append(
                        {
                            "toolCallId": tc_id,
                            "result": billing_service.limit_reached_message("voice_minutes"),
                        }
                    )
                    continue
                order_result = voice_order_service.place_order_from_tool_call(
                    workspace_id=workspace_id,
                    location_id=location_id,
                    conversation_id=conv["id"] if conv else None,
                    customer_id=conv.get("customer_id") if conv else None,
                    customer_phone=(conv or {}).get("customer_phone"),
                    arguments=args if isinstance(args, dict) else {},
                )
                # Schedule SMS confirmation + push notification AFTER we respond
                # to Vapi — see comment in voice_order_service for why this can
                # not block the response.
                if order_result.get("success"):
                    background_tasks.add_task(
                        voice_order_service.send_post_order_notifications,
                        workspace_id=workspace_id,
                        location_id=location_id,
                        customer_phone=(conv or {}).get("customer_phone"),
                        customer_name=order_result.get("customer_name"),
                        order_id=order_result["order_id"],
                        items_json=order_result["items_json"],
                        total_cents=order_result["total_cents"],
                        fulfillment=order_result["fulfillment"],
                    )
                results.append({"toolCallId": tc_id, "result": order_result["message"]})
            else:
                log.warning("vapi_unknown_tool", name=name, args_preview=str(args)[:120])
                results.append(
                    {"toolCallId": tc_id, "result": f"Unknown tool {name}, sorry."}
                )

        return {"results": results}

    if event_type == "transcript":
        if call_id:
            conv = _ensure_conversation(workspace_id, location_id, call, message)
            role = message.get("role", "agent")
            transcript_role = "customer" if role == "user" else "agent"
            content = message.get("transcript") or ""
            if content:
                db.table("conversation_messages").insert(
                    {
                        "conversation_id": conv["id"],
                        "role": transcript_role,
                        "content": content,
                    }
                ).execute()
        return {"status": "ok"}

    if event_type == "end-of-call-report":
        if call_id:
            conv = _ensure_conversation(workspace_id, location_id, call, message)
            analysis = message.get("analysis") or {}
            summary = analysis.get("summary")
            sentiment_raw = analysis.get("structuredData", {}).get("sentiment")
            try:
                sentiment = float(sentiment_raw) if sentiment_raw is not None else None
            except (TypeError, ValueError):
                sentiment = None
            recording_url = message.get("recordingUrl") or call.get("recordingUrl")

            started = call.get("startedAt") or conv.get("started_at")
            ended = call.get("endedAt") or datetime.now(timezone.utc).isoformat()
            duration = None
            try:
                if started and ended:
                    s = datetime.fromisoformat(str(started).replace("Z", "+00:00"))
                    e = datetime.fromisoformat(str(ended).replace("Z", "+00:00"))
                    duration = int((e - s).total_seconds())
            except (TypeError, ValueError):
                pass

            db.table("conversations").update(
                {
                    "ended_at": ended,
                    "duration_seconds": duration,
                    "status": "ended",
                    "sentiment": sentiment,
                    "summary": summary,
                    "recording_url": recording_url,
                }
            ).eq("id", conv["id"]).execute()

            billing_service.record_voice_call_minutes(
                workspace_id=workspace_id,
                location_id=location_id,
                conversation_id=conv["id"],
                duration_seconds=duration,
                vapi_call_id=call_id,
            )
        return {"status": "ok"}

    return {"status": "ignored"}


def _ensure_conversation(
    workspace_id: str,
    location_id: str | None,
    call: dict[str, Any],
    message: dict[str, Any],
) -> dict[str, Any]:
    """Find or create the conversation row keyed by the Vapi call id.

    We store the Vapi call id in conversations.metadata.vapi_call_id so
    subsequent events on the same call go to the same row."""
    db = get_supabase_admin()
    call_id = call.get("id")
    if not call_id:
        raise ValueError("missing call id")

    existing = (
        db.table("conversations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .contains("metadata", {"vapi_call_id": call_id})
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    customer_phone = (
        (call.get("customer") or {}).get("number")
        or message.get("customerNumber")
    )
    customer_id: str | None = None
    if customer_phone:
        cust = customer_service.upsert_by_phone(
            workspace_id, CustomerUpsert(phone=customer_phone)
        )
        customer_id = cust.id

    res = (
        db.table("conversations")
        .insert(
            {
                "workspace_id": workspace_id,
                "location_id": location_id,
                "customer_id": customer_id,
                "channel": "voice",
                "customer_phone": customer_phone,
                "started_at": call.get("startedAt") or datetime.now(timezone.utc).isoformat(),
                "status": "active",
                "metadata": {"vapi_call_id": call_id},
            }
        )
        .execute()
    )
    return res.data[0]


# ---------------------------------------------------------------------------
# WhatsApp (Twilio) inbound messages
# ---------------------------------------------------------------------------


def _find_or_create_whatsapp_conversation(
    *,
    workspace_id: str,
    location_id: str,
    customer_phone: str,
    customer_id: str | None,
    customer_name: str | None,
    session_window_hours: int,
) -> dict[str, Any]:
    """Reuse an active WhatsApp conversation within the session window, else
    open a new one. Keyed by (workspace, phone, channel='whatsapp')."""
    db = get_supabase_admin()
    window_start = (
        datetime.now(timezone.utc) - timedelta(hours=session_window_hours)
    ).isoformat()

    existing = (
        db.table("conversations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("customer_phone", customer_phone)
        .eq("channel", "whatsapp")
        .eq("status", "active")
        .gte("started_at", window_start)
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    res = (
        db.table("conversations")
        .insert(
            {
                "workspace_id": workspace_id,
                "location_id": location_id,
                "customer_id": customer_id,
                "channel": "whatsapp",
                "customer_phone": customer_phone,
                "customer_name": customer_name,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
                "metadata": {"transport": "twilio_whatsapp"},
            }
        )
        .execute()
    )
    return res.data[0]


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    x_twilio_signature: str | None = Header(default=None, alias="X-Twilio-Signature"),
) -> Response:
    """Inbound WhatsApp message from Twilio.

    Twilio retries on any non-200, which would duplicate replies, so this
    handler ALWAYS returns 200 with empty TwiML — every failure path is
    logged and swallowed."""
    try:
        form = await request.form()
        params = {k: str(v) for k, v in form.items()}
    except Exception as exc:  # noqa: BLE001
        log.error("whatsapp_webhook_bad_form", error=str(exc))
        return _twiml_ok()

    from_raw = params.get("From", "")
    to_raw = params.get("To", "")
    body = (params.get("Body") or "").strip()
    message_sid = params.get("MessageSid")
    profile_name = params.get("ProfileName") or None

    from_number = _strip_whatsapp_prefix(from_raw)
    to_number = _strip_whatsapp_prefix(to_raw)

    if not from_number or not to_number:
        log.warning("whatsapp_webhook_missing_numbers")
        return _twiml_ok()

    match = whatsapp_service.find_location_by_whatsapp_number(to_number)
    if not match:
        log.warning("whatsapp_webhook_unmatched_number", to=to_number)
        return _twiml_ok()
    workspace_id, location_id = match

    config = whatsapp_service.get_location_config_internal(location_id)
    if not config:
        log.warning("whatsapp_webhook_no_config", location_id=location_id)
        return _twiml_ok()

    # Verify the Twilio signature against this location's auth token. In dev
    # (no token) this logs-and-passes; in prod it enforces.
    signature_ok = twilio_whatsapp.verify_twilio_signature(
        url=str(request.url),
        params=params,
        signature=x_twilio_signature,
        auth_token=config.twilio_auth_token,
    )
    if not signature_ok:
        log.warning("whatsapp_webhook_bad_signature", location_id=location_id)
        return _twiml_ok()

    if not body:
        # Media-only or empty message — nothing to reason about in V2 (text only).
        return _twiml_ok()

    settings_row = whatsapp_service.get_or_create_settings(workspace_id)

    if not billing_service.channel_allowed(workspace_id, "whatsapp"):
        log.warning("whatsapp_channel_not_in_plan", workspace_id=workspace_id)
        twilio_whatsapp.send_whatsapp_message(
            to=from_number,
            from_=to_number,
            body=(
                "WhatsApp ordering isn't included in your current plan. "
                "Please call us instead."
            ),
            account_sid=config.twilio_account_sid,
            auth_token=config.twilio_auth_token,
        )
        return _twiml_ok()

    if not billing_service.check_allowed(
        workspace_id, "whatsapp_in", channel="whatsapp"
    ):
        log.warning("whatsapp_usage_limit", workspace_id=workspace_id)
        twilio_whatsapp.send_whatsapp_message(
            to=from_number,
            from_=to_number,
            body=billing_service.limit_reached_message("whatsapp_in"),
            account_sid=config.twilio_account_sid,
            auth_token=config.twilio_auth_token,
        )
        return _twiml_ok()

    db = get_supabase_admin()
    try:
        customer = customer_service.upsert_by_phone(
            workspace_id,
            CustomerUpsert(phone=from_number, name=profile_name),
        )
        conversation = _find_or_create_whatsapp_conversation(
            workspace_id=workspace_id,
            location_id=location_id,
            customer_phone=from_number,
            customer_id=customer.id,
            customer_name=profile_name,
            session_window_hours=settings_row.session_window_hours,
        )
        conversation_id = conversation["id"]

        # Dedup Twilio retries: skip if we already processed this MessageSid.
        if message_sid and (conversation.get("metadata") or {}).get(
            "last_message_sid"
        ) == message_sid:
            log.info("whatsapp_webhook_duplicate_skipped", message_sid=message_sid)
            return _twiml_ok()

        db.table("conversation_messages").insert(
            {
                "conversation_id": conversation_id,
                "role": "customer",
                "content": body,
            }
        ).execute()

        billing_service.record_usage(
            workspace_id=workspace_id,
            event_type="whatsapp_in",
            location_id=location_id,
            conversation_id=conversation_id,
            idempotency_key=f"wa-in:{message_sid}" if message_sid else None,
        )

        result = whatsapp_ai_service.get_ai_reply(workspace_id, conversation_id, body)
        reply_text = result.get("reply") or "Thanks for your message!"

        db.table("conversation_messages").insert(
            {
                "conversation_id": conversation_id,
                "role": "agent",
                "content": reply_text,
            }
        ).execute()

        # Record the processed sid for dedup on the conversation row.
        merged_meta = {
            **(conversation.get("metadata") or {}),
            "last_message_sid": message_sid,
        }
        db.table("conversations").update({"metadata": merged_meta}).eq(
            "id", conversation_id
        ).execute()

        twilio_whatsapp.send_whatsapp_message(
            to=from_number,
            from_=to_number,
            body=reply_text,
            account_sid=config.twilio_account_sid,
            auth_token=config.twilio_auth_token,
        )

        usage = result.get("usage") or {}
        billing_service.record_usage(
            workspace_id=workspace_id,
            event_type="whatsapp_out",
            location_id=location_id,
            conversation_id=conversation_id,
            idempotency_key=f"wa-out:{message_sid}" if message_sid else None,
            prompt_tokens=usage.get("prompt_tokens"),
            completion_tokens=usage.get("completion_tokens"),
            total_tokens=usage.get("total_tokens"),
            provider="openai" if usage.get("total_tokens") else None,
        )

        log.info(
            "whatsapp_webhook_handled",
            workspace_id=workspace_id,
            location_id=location_id,
            conversation_id=conversation_id,
            order_placed=result.get("order_placed"),
        )
    except Exception as exc:  # noqa: BLE001
        log.error("whatsapp_webhook_processing_error", error=str(exc))
        # Best-effort fallback so the customer isn't left hanging.
        try:
            twilio_whatsapp.send_whatsapp_message(
                to=from_number,
                from_=to_number,
                body=(
                    "Sorry, I'm having trouble right now. Please call us or try "
                    "again in a moment."
                ),
                account_sid=config.twilio_account_sid,
                auth_token=config.twilio_auth_token,
            )
        except Exception:  # noqa: BLE001
            pass

    return _twiml_ok()
