"""Public (no-auth) webhook endpoints.

Vapi posts call events here. We verify the HMAC signature and then
update the conversations / conversation_messages tables accordingly.

Webhook event shapes are documented at https://docs.vapi.ai/server-url.
"""

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Header, Request, status

import json

from app.core.exceptions import ForbiddenError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import vapi
from app.services import customer_service, voice_order_service, voice_service
from app.models.customer import CustomerUpsert

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
    x_vapi_secret: str | None = Header(default=None, alias="x-vapi-secret"),
    x_vapi_signature: str | None = Header(default=None, alias="x-vapi-signature"),
) -> dict[str, str]:
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
                order_result = voice_order_service.place_order_from_tool_call(
                    workspace_id=workspace_id,
                    location_id=location_id,
                    conversation_id=conv["id"] if conv else None,
                    customer_id=conv.get("customer_id") if conv else None,
                    customer_phone=(conv or {}).get("customer_phone"),
                    arguments=args if isinstance(args, dict) else {},
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
