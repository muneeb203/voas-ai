import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Path, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.core.exceptions import (
    AppError,
    ConflictError,
    KioskLimitError,
    NotFoundError,
    ServiceUnavailableError,
)
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.salon import BookAppointmentInput
from app.services import (
    booking_service,
    notification_service,
    salon_service,
    voice_order_service,
)
from app.services.voice_service import _menu_context_for_workspace
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["kiosk"])
public_router = APIRouter(tags=["kiosk"])

log = get_logger(__name__)

_LOW_KIOSK_CREDITS = 10  # notify the owner at this balance, and again at 0
SESSION_LOCK_TTL_SECONDS = 60


def _consume_kiosk_credit(db, workspace_id: str) -> None:
    """Decrement one kiosk credit and warn the owner if it just crossed the low
    or empty mark. Best-effort — never breaks the order."""
    try:
        res = db.rpc("decrement_kiosk_credit", {"p_workspace_id": workspace_id}).execute()
        balance = (res.data or {}).get("balance") if isinstance(res.data, dict) else None
        if balance in (_LOW_KIOSK_CREDITS, 0):
            notification_service.notify_kiosk_low(workspace_id=workspace_id, balance=balance)
    except Exception as exc:
        log.error("kiosk_credit_consume_failed", workspace_id=workspace_id, error=str(exc))
SYSTEM_PROMPT_TTL_SECONDS = 120
KIOSK_CTX_TTL_SECONDS = 60

# workspace_id → (expires_at_monotonic, system_prompt). Per-process cache; each
# uvicorn worker warms independently. Menu/prompt edits appear after at most the TTL.
_system_prompt_cache: dict[str, tuple[float, str]] = {}

# token → (expires_at_monotonic, {workspace_id, location_id}). Skips the token
# validation query on the hot chat/speak path (revocation takes effect within
# the TTL).
_kiosk_ctx_cache: dict[str, tuple[float, dict]] = {}

# Shared async HTTP client so calls to Anthropic / OpenAI reuse pooled keep-alive
# connections instead of paying a fresh DNS+TCP+TLS handshake every turn.
_shared_http: httpx.AsyncClient | None = None


def _get_http() -> httpx.AsyncClient:
    global _shared_http
    if _shared_http is None:
        _shared_http = httpx.AsyncClient(timeout=30.0)
    return _shared_http

KIOSK_SYSTEM_PROMPT = """You are the ordering assistant on an in-store self-service kiosk for a restaurant. Customers walk up and speak their order; you take it and place it.

How you work:
- Offer ONLY items from the MENU below. If asked for something not on it, say it isn't available and suggest the closest match.
- Keep every reply to ONE short sentence, 15 words maximum. No filler ("Sure!", "Great choice!", "Of course!").
- This is in-person counter pickup. NEVER ask for a name, phone number, or delivery address — you do not need them.

Placing the order (critical):
- The order is placed ONLY when you call the place_order tool. There is no other way.
- As soon as the customer indicates they are done or confirms — e.g. "that's it", "that's all", "yes", "confirm", "place it" — your response for that turn MUST be a place_order tool call, not text.
- Saying "your order is placed" (or similar) in text WITHOUT calling the tool in the same turn is a failure. Never do it.
- Pass every ordered item with its quantity to the tool.
- After the tool call, the kiosk automatically shows the confirmation screen — you don't announce it.

MENU:
"""

PLACE_ORDER_TOOL: dict = {
    "name": "place_order",
    "description": "Call this when the customer has confirmed their complete order and is ready to proceed.",
    "input_schema": {
        "type": "object",
        "properties": {
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string"},
                        "qty": {"type": "integer"},
                        "price": {"type": "string"},
                    },
                    "required": ["name", "qty"],
                },
                "description": "List of ordered items with quantities.",
            },
            "order_number": {
                "type": "string",
                "description": "Short order number shown on the receipt screen, e.g. '#1042'.",
            },
            "total": {"type": "string", "description": "Total price string, e.g. '$14.50'."},
        },
        "required": ["items"],
    },
}

SALON_KIOSK_SYSTEM_PROMPT = """You are the self-service assistant at a salon's in-store kiosk. Customers walk up and speak.

You can do two things:
1) BOOK a walk-in appointment for one of the services below.
2) CHECK IN a customer who already has an appointment today.

Rules:
- Reply in ONE short sentence, 15 words maximum. No filler.
- Offer times ONLY from the AVAILABLE APPOINTMENTS list. Never invent a time.
- To BOOK: once the customer confirms a specific service and time, call the book_appointment tool with the service_id, starts_at, and staff_id copied EXACTLY from the list, plus their name if given.
- To CHECK IN: if the customer says they've arrived for an existing appointment, get their name, then call the check_in tool with that name.
- Calling the tool IS how it happens — never say it's done in text without calling the tool.

"""

BOOK_APPOINTMENT_TOOL: dict = {
    "name": "book_appointment",
    "description": "Book a walk-in appointment once the customer confirms a specific service and time.",
    "input_schema": {
        "type": "object",
        "properties": {
            "service_id": {"type": "string", "description": "Copied exactly from the list."},
            "starts_at": {"type": "string", "description": "ISO 8601 UTC, copied exactly."},
            "staff_id": {"type": "string", "description": "Copied exactly, or omit."},
            "customer_name": {"type": "string"},
        },
        "required": ["service_id", "starts_at"],
    },
}

CHECK_IN_TOOL: dict = {
    "name": "check_in",
    "description": "Check in a customer who already has an appointment today.",
    "input_schema": {
        "type": "object",
        "properties": {"customer_name": {"type": "string"}},
        "required": ["customer_name"],
    },
}


# ── Pydantic models ────────────────────────────────────────────────────────────


class KioskToken(BaseModel):
    id: str
    location_id: str
    token: str
    is_active: bool
    created_at: str
    last_used_at: str | None = None


class KioskSettings(BaseModel):
    theme: str  # 'warm' | 'light' | 'gradient'
    session_lock_enabled: bool
    kiosk_enabled: bool = False
    max_kiosk_urls: int = 1
    kiosk_monthly_limit: int = 500
    kiosk_credits_balance: int = 0
    kiosk_credits_used_this_month: int = 0
    kiosk_month_start: str | None = None
    restaurant_tone: str | None = None
    restaurant_handover: str | None = None
    salon_tone: str | None = None
    salon_handover: str | None = None
    manual_ordering_enabled: bool = False
    kiosk_order_mode: str = "both"  # voice | manual | both
    phone_ordering_enabled: bool = False
    phone_order_lock_enabled: bool = False
    phone_order_lock_minutes: int = 30


class KioskSettingsUpdate(BaseModel):
    theme: str | None = None
    session_lock_enabled: bool | None = None
    # Owner-editable voice. Empty string clears the field, so these can't use
    # None-as-absent alone — the router checks for `is not None`.
    restaurant_tone: str | None = Field(default=None, max_length=1000)
    restaurant_handover: str | None = Field(default=None, max_length=1000)
    salon_tone: str | None = Field(default=None, max_length=1000)
    salon_handover: str | None = Field(default=None, max_length=1000)
    manual_ordering_enabled: bool | None = None
    phone_order_lock_enabled: bool | None = None
    phone_order_lock_minutes: int | None = Field(default=None, ge=1, le=1440)


class KioskInfo(BaseModel):
    location_name: str
    workspace_name: str
    theme: str
    session_lock_enabled: bool
    vertical: str = "restaurant"
    # The effective mode the kiosk should render: 'voice' (voice only, no
    # button), 'manual' (tap only, straight to menu), or 'both' (voice + switch).
    # Already collapses disabled/salon down to 'voice', so the client just obeys.
    order_mode: str = "voice"


class PhoneOrderInfo(BaseModel):
    location_name: str
    workspace_name: str
    order_lock_enabled: bool = False
    order_lock_minutes: int = 30


class KioskMenuOption(BaseModel):
    id: str
    name: str
    price_delta_cents: int
    is_default: bool


class KioskMenuGroup(BaseModel):
    id: str
    name: str
    min_select: int
    max_select: int
    required: bool
    options: list[KioskMenuOption]


class KioskMenuItem(BaseModel):
    id: str
    name: str
    description: str | None
    price_cents: int
    image_url: str | None
    modifier_groups: list[KioskMenuGroup]


class KioskMenuCategory(BaseModel):
    id: str
    name: str
    items: list[KioskMenuItem]


class KioskMenu(BaseModel):
    categories: list[KioskMenuCategory]
    currency_symbol: str = "$"
    currency_decimals: int = 2


class ManualOrderOption(BaseModel):
    option_id: str


class ManualOrderLine(BaseModel):
    item_id: str
    quantity: int = Field(default=1, ge=1, le=99)
    option_ids: list[str] = Field(default_factory=list)


class ManualOrderBody(BaseModel):
    items: list[ManualOrderLine] = Field(..., min_length=1, max_length=50)


class ManualOrderResult(BaseModel):
    success: bool
    order_id: str | None = None
    order_number: str | None = None
    total: str | None = None
    message: str | None = None


class KioskSttToken(BaseModel):
    # Short-lived Deepgram token the browser uses to open its own streaming
    # STT socket. The real Deepgram key never leaves the server.
    access_token: str
    expires_in: int
    model: str
    endpointing_ms: int
    keywords: list[str]


class SessionBody(BaseModel):
    session_id: str


class KioskChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class KioskChatBody(BaseModel):
    messages: list[KioskChatMessage]


class KioskMetricBody(BaseModel):
    stt_source: Literal["deepgram", "browser"]
    stt_confidence: float | None = None
    chat_ms: int | None = None
    anthropic_ms: int | None = None
    tts_ms: int | None = None
    order_placed: bool = False


class KioskChatResponse(BaseModel):
    response: str
    order_confirmed: bool
    order: dict | None = None
    appointment: dict | None = None  # salon: booked/checked-in details for the confirm screen
    debug: dict | None = None  # timing/token info for the ?debug overlay


class KioskSpeakBody(BaseModel):
    text: str
    # 'pcm' streams raw 24kHz/16-bit/mono audio as OpenAI generates it (low latency,
    # played on the client's unlocked AudioContext). 'mp3' returns the full clip.
    format: Literal["mp3", "pcm"] = "mp3"


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_ws_kiosk_settings(db, workspace_id: str) -> KioskSettings:
    # select("*") not an explicit column list: naming a column that a not-yet-run
    # migration would add makes this read 500 and takes the kiosk down. The model
    # ignores extra columns and defaults anything missing.
    res = (
        db.table("workspace_kiosk_settings")
        .select("*")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return KioskSettings(**res.data[0])
    return KioskSettings(
        theme="gradient",
        session_lock_enabled=False,
        kiosk_enabled=False,
        max_kiosk_urls=1,
    )


def _get_token_row(db, token: str) -> dict:
    res = (
        db.table("kiosk_tokens")
        .select("id, workspace_id, location_id, is_active, active_session_id, session_heartbeat_at")
        .eq("token", token)
        .limit(1)
        .execute()
    )
    if not res.data or not res.data[0]["is_active"]:
        raise NotFoundError("Kiosk not found or no longer active")
    return res.data[0]


def _is_lock_held(row: dict, session_id: str) -> bool:
    active_id = row.get("active_session_id")
    heartbeat_str = row.get("session_heartbeat_at")
    if not active_id or active_id == session_id or not heartbeat_str:
        return False
    heartbeat_at = datetime.fromisoformat(heartbeat_str.replace("Z", "+00:00"))
    return (datetime.now(UTC) - heartbeat_at) < timedelta(seconds=SESSION_LOCK_TTL_SECONDS)


def _owner_voice_block(db, workspace_id: str, vertical: str) -> str:
    """The owner's tone + order-handover text, as a prompt section.

    Appended AFTER the locked operational rules so it can shape how the kiosk
    sounds and what it tells customers about collecting their order, but can
    never remove the rule that an order only exists once place_order is called.
    """
    cfg = _get_ws_kiosk_settings(db, workspace_id)
    tone = (cfg.salon_tone if vertical == "salon" else cfg.restaurant_tone) or ""
    handover = (cfg.salon_handover if vertical == "salon" else cfg.restaurant_handover) or ""
    tone, handover = tone.strip(), handover.strip()
    if not tone and not handover:
        return ""

    parts = ["\n\n--- HOW THIS BUSINESS WANTS YOU TO SOUND ---"]
    if tone:
        parts.append(f"Tone: {tone}")
    if handover:
        parts.append(
            "After the order is placed, tell the customer this is what happens next: "
            f"{handover}"
        )
    parts.append(
        "Follow this for style and for what you tell the customer — but never at the "
        "expense of the rules above. Still one short sentence, and still only a real "
        "tool call places an order."
    )
    return "\n".join(parts)


def _build_kiosk_system_prompt(db, workspace_id: str) -> str:
    # Self-contained kiosk prompt. We deliberately do NOT reuse the voice
    # system prompt: it requires collecting name/phone and confirming
    # delivery, which a walk-up kiosk never has — that contradiction made the
    # model acknowledge orders verbally instead of calling place_order.
    menu_md = _menu_context_for_workspace(workspace_id)
    voice = _owner_voice_block(db, workspace_id, "restaurant")
    return f"{KIOSK_SYSTEM_PROMPT}{menu_md}{voice}".strip()


def _get_kiosk_system_prompt(db, workspace_id: str) -> str:
    """Cached per workspace for SYSTEM_PROMPT_TTL_SECONDS to avoid rebuilding the
    voice-settings + menu context (2 DB round trips) on every kiosk turn."""
    now = time.monotonic()
    cached = _system_prompt_cache.get(workspace_id)
    if cached and cached[0] > now:
        return cached[1]
    prompt = _build_kiosk_system_prompt(db, workspace_id)
    _system_prompt_cache[workspace_id] = (now + SYSTEM_PROMPT_TTL_SECONDS, prompt)
    return prompt


def _build_salon_kiosk_system_prompt(db, workspace_id: str) -> str:
    # Not cached: availability changes with every booking, and create_appointment
    # re-checks the slot at commit anyway.
    availability = booking_service.availability_prompt_context(workspace_id)
    voice = _owner_voice_block(db, workspace_id, "salon")
    return f"{SALON_KIOSK_SYSTEM_PROMPT}{availability}{voice}".strip()


def _appt_display(appt, kind: str, workspace_id: str, location_id: str | None) -> dict:
    tz = booking_service._location_tz(workspace_id, location_id)
    return {
        "kind": kind,  # 'booked' | 'checked_in'
        "service_name": appt.service_name,
        "staff_name": appt.staff_name,
        "when": appt.starts_at.astimezone(tz).strftime("%a %b %d, %I:%M %p"),
        "order_number": f"#{str(appt.id)[:6].upper()}",
    }


def _handle_salon_kiosk_chat(db, workspace_id, ctx, token, content_blocks, debug_info, body):
    """Salon kiosk: handle the book_appointment / check_in tool calls."""
    location_id = ctx["location_id"]
    for block in content_blocks:
        if block.get("type") != "tool_use":
            continue
        name = block.get("name")
        args: dict = block.get("input", {})

        if name == "book_appointment":
            if not args.get("service_id") or not args.get("starts_at"):
                return ok(
                    KioskChatResponse(
                        response="Sorry, which service and time would you like?",
                        order_confirmed=False,
                        debug=debug_info,
                    )
                )
            conversation_id = _create_kiosk_conversation(db, workspace_id, location_id, body.messages)
            try:
                appt = booking_service.create_appointment(
                    workspace_id,
                    BookAppointmentInput(
                        service_id=args["service_id"],
                        starts_at=args["starts_at"],
                        staff_id=args.get("staff_id"),
                        customer_name=args.get("customer_name"),
                        location_id=location_id,
                        conversation_id=conversation_id,
                    ),
                )
            except AppError as exc:
                return ok(
                    KioskChatResponse(response=exc.message, order_confirmed=False, debug=debug_info)
                )
            except Exception as exc:
                log.error("kiosk_book_failed", workspace_id=workspace_id, error=str(exc))
                return ok(
                    KioskChatResponse(
                        response="Sorry, I couldn't book that — please try again.",
                        order_confirmed=False,
                        debug=debug_info,
                    )
                )
            _consume_kiosk_credit(db, workspace_id)
            return ok(
                KioskChatResponse(
                    response="You're booked!",
                    order_confirmed=True,
                    appointment=_appt_display(appt, "booked", workspace_id, location_id),
                    debug=debug_info,
                )
            )

        if name == "check_in":
            appt = salon_service.check_in_by_name(workspace_id, args.get("customer_name", ""))
            if not appt:
                return ok(
                    KioskChatResponse(
                        response="I couldn't find your appointment — please see the front desk.",
                        order_confirmed=False,
                        debug=debug_info,
                    )
                )
            return ok(
                KioskChatResponse(
                    response="You're checked in!",
                    order_confirmed=True,
                    appointment=_appt_display(appt, "checked_in", workspace_id, location_id),
                    debug=debug_info,
                )
            )

    text = next(
        (b["text"] for b in content_blocks if b.get("type") == "text"),
        "Sorry, could you repeat that?",
    )
    return ok(KioskChatResponse(response=text, order_confirmed=False, debug=debug_info))


def _get_kiosk_chat_context(db, token: str) -> dict:
    """Cached token → {workspace_id, location_id} for the hot /chat and /speak
    paths, so the token lookup doesn't run on every turn. The kiosk is always
    available; access is gated only by the credit balance (checked in /chat)."""
    now = time.monotonic()
    cached = _kiosk_ctx_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]
    row = _get_token_row(db, token)
    ws = (
        db.table("workspaces").select("vertical").eq("id", row["workspace_id"]).limit(1).execute()
    )
    vertical = ws.data[0]["vertical"] if ws.data else "restaurant"
    ctx = {
        "workspace_id": row["workspace_id"],
        "location_id": row["location_id"],
        "vertical": vertical,
    }
    _kiosk_ctx_cache[token] = (now + KIOSK_CTX_TTL_SECONDS, ctx)
    return ctx


def _kiosk_stt_keywords(db, workspace_id: str) -> list[str]:
    """Menu item names, passed to Deepgram as keyword hints so it recognises
    dish names ('Zinger', 'Alfredo') it would otherwise mishear."""
    res = (
        db.table("menu_items")
        .select("name")
        .eq("workspace_id", workspace_id)
        .eq("is_active", True)
        .limit(300)
        .execute()
    )
    names: list[str] = []
    seen: set[str] = set()
    for row in res.data or []:
        name = (row.get("name") or "").strip()
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            names.append(name)
    return names[:150]


def _create_kiosk_conversation(
    db, workspace_id: str, location_id: str | None, messages: list[KioskChatMessage]
) -> str | None:
    """Record the kiosk order as a 'kiosk'-channel conversation (with transcript)
    so it shows in the Conversations tab and analytics channel breakdown.

    Best-effort: any failure (e.g. the kiosk-channel migration not applied yet)
    returns None so the order is still created without a conversation link.
    """
    try:
        now_iso = datetime.now(UTC).isoformat()
        conv_res = (
            db.table("conversations")
            .insert(
                {
                    "workspace_id": workspace_id,
                    "location_id": location_id,
                    "channel": "kiosk",
                    "status": "ended",
                    "started_at": now_iso,
                    "ended_at": now_iso,
                }
            )
            .execute()
        )
        if not conv_res.data:
            return None
        conversation_id = conv_res.data[0]["id"]

        rows = [
            {
                "conversation_id": conversation_id,
                "role": "customer" if m.role == "user" else "agent",
                "content": m.content.strip(),
            }
            for m in messages
            if m.content.strip()
        ]
        if rows:
            db.table("conversation_messages").insert(rows).execute()
        return conversation_id
    except Exception:
        return None


# ── Authenticated routes ───────────────────────────────────────────────────────


@router.get(
    "/workspaces/{workspace_id}/kiosk-tokens",
    response_model=DataResponse[list[KioskToken]],
)
async def list_kiosk_tokens(ctx: WorkspaceContextDep) -> DataResponse[list[KioskToken]]:
    db = get_supabase_admin()
    res = (
        db.table("kiosk_tokens")
        .select("id, location_id, token, is_active, created_at, last_used_at")
        .eq("workspace_id", ctx.workspace_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    return ok([KioskToken(**row) for row in res.data])


@router.post(
    "/workspaces/{workspace_id}/locations/{location_id}/kiosk-tokens",
    response_model=DataResponse[KioskToken],
    status_code=status.HTTP_201_CREATED,
)
async def generate_kiosk_token(
    location_id: Annotated[str, Path()],
    ctx: OwnerContextDep,
) -> DataResponse[KioskToken]:
    db = get_supabase_admin()

    loc = (
        db.table("locations")
        .select("id")
        .eq("id", location_id)
        .eq("workspace_id", ctx.workspace_id)
        .limit(1)
        .execute()
    )
    if not loc.data:
        raise NotFoundError("Location not found")

    # Revoke all non-revoked tokens for this location (active and disabled)
    db.table("kiosk_tokens").update(
        {"is_active": False, "revoked_at": datetime.now(UTC).isoformat()}
    ).eq("location_id", location_id).eq("workspace_id", ctx.workspace_id).is_(
        "revoked_at", "null"
    ).execute()

    token = secrets.token_hex(32)
    insert_res = (
        db.table("kiosk_tokens")
        .insert(
            {
                "workspace_id": ctx.workspace_id,
                "location_id": location_id,
                "token": token,
                "is_active": True,
                "created_by": ctx.user.id,
            }
        )
        .execute()
    )
    return ok(KioskToken(**insert_res.data[0]))


@router.delete(
    "/workspaces/{workspace_id}/kiosk-tokens/{token_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_kiosk_token(
    token_id: Annotated[str, Path()],
    ctx: OwnerContextDep,
) -> None:
    db = get_supabase_admin()
    res = (
        db.table("kiosk_tokens")
        .select("id")
        .eq("id", token_id)
        .eq("workspace_id", ctx.workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Kiosk token not found")
    db.table("kiosk_tokens").update(
        {"is_active": False, "revoked_at": datetime.now(UTC).isoformat()}
    ).eq("id", token_id).execute()


@router.get(
    "/workspaces/{workspace_id}/kiosk-settings",
    response_model=DataResponse[KioskSettings],
)
async def get_kiosk_settings(ctx: WorkspaceContextDep) -> DataResponse[KioskSettings]:
    db = get_supabase_admin()
    return ok(_get_ws_kiosk_settings(db, ctx.workspace_id))


@router.patch(
    "/workspaces/{workspace_id}/kiosk-settings",
    response_model=DataResponse[KioskSettings],
)
async def update_kiosk_settings(
    body: KioskSettingsUpdate,
    ctx: OwnerContextDep,
) -> DataResponse[KioskSettings]:
    db = get_supabase_admin()
    existing = (
        db.table("workspace_kiosk_settings")
        .select("id")
        .eq("workspace_id", ctx.workspace_id)
        .limit(1)
        .execute()
    )
    changes: dict = {"updated_at": datetime.now(UTC).isoformat()}
    if body.theme is not None:
        changes["theme"] = body.theme
    if body.session_lock_enabled is not None:
        changes["session_lock_enabled"] = body.session_lock_enabled
    for field in ("restaurant_tone", "restaurant_handover", "salon_tone", "salon_handover"):
        value = getattr(body, field)
        if value is not None:
            # "" is a real value here — it's how an owner clears the field.
            changes[field] = value.strip() or None
    if body.phone_order_lock_enabled is not None:
        changes["phone_order_lock_enabled"] = body.phone_order_lock_enabled
    if body.phone_order_lock_minutes is not None:
        changes["phone_order_lock_minutes"] = body.phone_order_lock_minutes

    if existing.data:
        res = (
            db.table("workspace_kiosk_settings")
            .update(changes)
            .eq("workspace_id", ctx.workspace_id)
            .execute()
        )
    else:
        changes["workspace_id"] = ctx.workspace_id
        changes.setdefault("theme", "gradient")
        changes.setdefault("session_lock_enabled", False)
        changes.setdefault("kiosk_enabled", False)
        changes.setdefault("max_kiosk_urls", 1)
        res = db.table("workspace_kiosk_settings").insert(changes).execute()

    # The restaurant prompt is cached for SYSTEM_PROMPT_TTL_SECONDS. Without this
    # an owner would edit the tone, walk to the kiosk, and hear the old wording
    # for up to two minutes — and reasonably conclude it didn't save.
    _system_prompt_cache.pop(ctx.workspace_id, None)

    return ok(KioskSettings(**res.data[0]))


# ── Public routes (no auth) ────────────────────────────────────────────────────


@public_router.get(
    "/kiosk/{token}",
    response_model=DataResponse[KioskInfo],
)
async def get_kiosk_info(token: Annotated[str, Path()]) -> DataResponse[KioskInfo]:
    db = get_supabase_admin()
    row = _get_token_row(db, token)
    workspace_id = row["workspace_id"]
    location_id = row["location_id"]

    kiosk_cfg = _get_ws_kiosk_settings(db, workspace_id)

    db.table("kiosk_tokens").update({"last_used_at": datetime.now(UTC).isoformat()}).eq(
        "id", row["id"]
    ).execute()

    loc_res = db.table("locations").select("name").eq("id", location_id).limit(1).execute()
    ws_res = (
        db.table("workspaces").select("name, vertical").eq("id", workspace_id).limit(1).execute()
    )
    ws_row = ws_res.data[0] if ws_res.data else {}

    return ok(
        KioskInfo(
            location_name=loc_res.data[0]["name"] if loc_res.data else "Restaurant",
            workspace_name=ws_row.get("name") or "",
            theme=kiosk_cfg.theme,
            session_lock_enabled=kiosk_cfg.session_lock_enabled,
            vertical=ws_row.get("vertical") or "restaurant",
            order_mode=_effective_order_mode(
                kiosk_cfg, ws_row.get("vertical") or "restaurant"
            ),
        )
    )


@public_router.get(
    "/kiosk/{token}/stt-token",
    response_model=DataResponse[KioskSttToken],
)
async def get_kiosk_stt_token(
    token: Annotated[str, Path()],
) -> DataResponse[KioskSttToken]:
    """Mint a short-lived Deepgram token for the browser's streaming recogniser.

    Returns 503 when no Deepgram key is configured; the kiosk client treats that
    as "fall back to the free in-browser recogniser", so the kiosk keeps working.
    """
    cfg = get_settings()
    if not cfg.deepgram_api_key:
        raise ServiceUnavailableError("Speech-to-text is not configured")

    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    keywords = _kiosk_stt_keywords(db, ctx["workspace_id"])

    try:
        resp = await _get_http().post(
            f"{cfg.deepgram_base_url}/v1/auth/grant",
            headers={
                "Authorization": f"Token {cfg.deepgram_api_key}",
                "content-type": "application/json",
            },
            json={"ttl_seconds": 60},
        )
    except Exception as exc:  # network error reaching Deepgram
        raise AppError("Could not obtain a speech-to-text token") from exc

    if resp.status_code != 200:
        raise AppError(f"Speech-to-text token request failed ({resp.status_code})")

    data = resp.json()
    return ok(
        KioskSttToken(
            access_token=data.get("access_token", ""),
            expires_in=int(data.get("expires_in", 30) or 30),
            model=cfg.deepgram_model,
            endpointing_ms=600,
            keywords=keywords,
        )
    )


@public_router.post(
    "/kiosk/{token}/metrics",
    response_model=DataResponse[dict],
)
async def record_kiosk_metric(
    token: Annotated[str, Path()],
    body: KioskMetricBody,
) -> DataResponse[dict]:
    """Best-effort per-turn metrics for the admin Kiosk Performance card.

    Never fails the kiosk: any error (bad token, migration not applied) is
    swallowed so the customer-facing flow is unaffected.
    """
    db = get_supabase_admin()
    try:
        ctx = _get_kiosk_chat_context(db, token)
        db.table("kiosk_turn_metrics").insert(
            {
                "workspace_id": ctx["workspace_id"],
                "location_id": ctx["location_id"],
                "stt_source": body.stt_source,
                "stt_confidence": body.stt_confidence,
                "chat_ms": body.chat_ms,
                "anthropic_ms": body.anthropic_ms,
                "tts_ms": body.tts_ms,
                "order_placed": body.order_placed,
            }
        ).execute()
    except Exception as exc:
        log.warning("kiosk_metric_insert_failed", error=str(exc))
    return ok({"recorded": True})


@public_router.post(
    "/kiosk/{token}/claim",
    response_model=DataResponse[dict],
)
async def claim_kiosk_session(
    token: Annotated[str, Path()],
    body: SessionBody,
) -> DataResponse[dict]:
    db = get_supabase_admin()
    row = _get_token_row(db, token)

    if _is_lock_held(row, body.session_id):
        raise ConflictError("Kiosk is already in use on another device")

    db.table("kiosk_tokens").update(
        {
            "active_session_id": body.session_id,
            "session_heartbeat_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", row["id"]).execute()

    return ok({"claimed": True})


@public_router.post(
    "/kiosk/{token}/heartbeat",
    response_model=DataResponse[dict],
)
async def heartbeat_kiosk_session(
    token: Annotated[str, Path()],
    body: SessionBody,
) -> DataResponse[dict]:
    db = get_supabase_admin()
    row = _get_token_row(db, token)

    if row.get("active_session_id") != body.session_id:
        raise ConflictError("Session has been taken over by another device")

    db.table("kiosk_tokens").update({"session_heartbeat_at": datetime.now(UTC).isoformat()}).eq(
        "id", row["id"]
    ).execute()

    return ok({"alive": True})


@public_router.post(
    "/kiosk/{token}/chat",
    response_model=DataResponse[KioskChatResponse],
)
async def kiosk_chat(
    token: Annotated[str, Path()],
    body: KioskChatBody,
) -> DataResponse[KioskChatResponse]:
    """Send conversation messages to Claude Haiku, get back a response (or order confirmation)."""
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]

    cfg = get_settings()
    if not cfg.anthropic_api_key:
        raise NotFoundError("AI not configured")

    # Credits are consumed per completed order (not per turn) — just gate here.
    bal_res = (
        db.table("workspace_kiosk_settings")
        .select("kiosk_credits_balance")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    balance = bal_res.data[0]["kiosk_credits_balance"] if bal_res.data else 0
    if balance <= 0:
        raise KioskLimitError("This kiosk is out of service. Please see the front desk.")

    vertical = ctx.get("vertical", "restaurant")
    if vertical == "salon":
        system_prompt = _build_salon_kiosk_system_prompt(db, workspace_id)
        tools = [BOOK_APPOINTMENT_TOOL, CHECK_IN_TOOL]
    else:
        system_prompt = _get_kiosk_system_prompt(db, workspace_id)
        tools = [PLACE_ORDER_TOOL]
    messages_payload = [m.model_dump() for m in body.messages]

    chat_t0 = time.perf_counter()
    resp = await _get_http().post(
        f"{cfg.anthropic_base_url}/v1/messages",
        headers={
            "x-api-key": cfg.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 400,
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": messages_payload,
            "tools": tools,
        },
    )

    anthropic_ms = int((time.perf_counter() - chat_t0) * 1000)

    if resp.status_code != 200:
        raise AppError(f"AI request failed ({resp.status_code}): {resp.text[:300]}")

    body_json = resp.json()
    usage = body_json.get("usage") or {}
    log.info(
        "kiosk_chat_timing",
        anthropic_ms=anthropic_ms,
        input_tokens=usage.get("input_tokens"),
        cache_read=usage.get("cache_read_input_tokens"),
        cache_write=usage.get("cache_creation_input_tokens"),
        output_tokens=usage.get("output_tokens"),
    )
    content_blocks = body_json.get("content", [])
    debug_info = {
        "anthropic_ms": anthropic_ms,
        "cache_read": usage.get("cache_read_input_tokens"),
        "cache_write": usage.get("cache_creation_input_tokens"),
        "input_tokens": usage.get("input_tokens"),
        "output_tokens": usage.get("output_tokens"),
    }

    tool_calls = [b.get("name") for b in content_blocks if b.get("type") == "tool_use"]
    log.info(
        "kiosk_chat_result",
        stop_reason=body_json.get("stop_reason"),
        tool_calls=tool_calls,
        has_text=any(b.get("type") == "text" for b in content_blocks),
    )

    if vertical == "salon":
        return _handle_salon_kiosk_chat(db, workspace_id, ctx, token, content_blocks, debug_info, body)

    for block in content_blocks:
        if block.get("type") == "tool_use" and block.get("name") == "place_order":
            order_input: dict = block.get("input", {})

            # Record a kiosk-channel conversation (for Conversations + analytics),
            # then persist the order priced against the workspace menu (same path
            # as voice/WhatsApp). Kiosk is counter-pickup, so there's no customer.
            mapped_items = [
                {"name": it.get("name"), "quantity": it.get("qty") or it.get("quantity") or 1}
                for it in (order_input.get("items") or [])
                if it.get("name")
            ]
            conversation_id = _create_kiosk_conversation(
                db, workspace_id, ctx["location_id"], body.messages
            )
            placed = voice_order_service.place_order_from_tool_call(
                workspace_id=workspace_id,
                location_id=ctx["location_id"],
                conversation_id=conversation_id,
                customer_id=None,
                customer_phone=None,
                arguments={
                    "items": mapped_items,
                    "fulfillment": "pickup",
                    "special_instructions": "Placed at kiosk",
                },
            )
            log.info(
                "kiosk_place_order",
                items_in=len(order_input.get("items") or []),
                items_mapped=len(mapped_items),
                success=placed.get("success"),
                order_id=placed.get("order_id"),
                message=placed.get("message"),
            )
            if not placed.get("success"):
                return ok(
                    KioskChatResponse(
                        response=placed.get(
                            "message",
                            "Sorry, I couldn't save that — could you repeat your order?",
                        ),
                        order_confirmed=False,
                        debug=debug_info,
                    )
                )

            # Order placed — consume one kiosk credit.
            _consume_kiosk_credit(db, workspace_id)

            order_id = str(placed.get("order_id") or "")
            if order_id:
                notification_service.notify_workspace_order(
                    workspace_id=workspace_id,
                    order_id=order_id,
                    title="New kiosk order",
                    body=None,
                )
            order_number = order_input.get("order_number") or (
                f"#{order_id[:6].upper()}" if order_id else f"#{1000 + (abs(hash(token)) % 9000)}"
            )
            order_display = {
                "items": [
                    {
                        "name": i.get("name"),
                        "qty": i.get("quantity"),
                        "price": f"${(i.get('unit_price_cents') or 0) / 100:.2f}",
                    }
                    for i in (placed.get("items_json") or [])
                ],
                "order_number": order_number,
                "total": f"${(placed.get('total_cents') or 0) / 100:.2f}",
            }
            return ok(
                KioskChatResponse(
                    response="Your order has been confirmed! We're preparing it now.",
                    order_confirmed=True,
                    order=order_display,
                    debug=debug_info,
                )
            )

    text = next(
        (b["text"] for b in content_blocks if b.get("type") == "text"),
        "Sorry, could you repeat that?",
    )
    return ok(KioskChatResponse(response=text, order_confirmed=False, debug=debug_info))


# ── Manual (tap-to-order) mode ────────────────────────────────────────────────


def _effective_order_mode(cfg: KioskSettings, vertical: str) -> str:
    """What the kiosk should actually do, collapsing the gates:
    disabled or salon -> 'voice'; otherwise the admin's chosen mode."""
    if vertical == "salon" or not cfg.manual_ordering_enabled:
        return "voice"
    mode = cfg.kiosk_order_mode
    return mode if mode in ("voice", "manual", "both") else "both"


def _require_manual_ordering(db, workspace_id: str, vertical: str) -> None:
    """Manual endpoints are only reachable when the effective mode allows tap
    ordering. Enforced server-side so a crafted request can't order through a
    kiosk configured voice-only, disabled, or on a salon."""
    cfg = _get_ws_kiosk_settings(db, workspace_id)
    if _effective_order_mode(cfg, vertical) not in ("manual", "both"):
        raise NotFoundError("Manual ordering is not available on this kiosk")


def _require_phone_ordering(db, workspace_id: str, vertical: str) -> None:
    """Phone (QR) ordering is its own admin-gated, restaurant-only switch —
    separate from the physical kiosk's mode. Guarded server-side."""
    if vertical == "salon":
        raise NotFoundError("Phone ordering is not available")
    cfg = _get_ws_kiosk_settings(db, workspace_id)
    if not cfg.phone_ordering_enabled:
        raise NotFoundError("Phone ordering is not enabled")


def _build_tap_menu(db, workspace_id: str) -> KioskMenu:
    """The tap-to-order menu payload, shared by the kiosk and phone routes."""
    from app.core import currency as currency_mod
    from app.services import menu_service

    categories = menu_service.list_categories(workspace_id)
    items = menu_service.list_items(workspace_id)

    by_category: dict[str, list[KioskMenuItem]] = {}
    for it in items:
        if not it.is_active:
            continue
        groups = [
            KioskMenuGroup(
                id=g.id,
                name=g.name,
                min_select=g.min_select,
                max_select=g.max_select,
                required=g.required,
                options=[
                    KioskMenuOption(
                        id=o.id,
                        name=o.name,
                        price_delta_cents=o.price_delta_cents,
                        is_default=o.is_default,
                    )
                    for o in g.options
                ],
            )
            for g in it.modifier_groups
        ]
        by_category.setdefault(it.category_id, []).append(
            KioskMenuItem(
                id=it.id,
                name=it.name,
                description=it.description,
                price_cents=it.price_cents,
                image_url=it.image_url,
                modifier_groups=groups,
            )
        )

    out = [
        KioskMenuCategory(id=c.id, name=c.name, items=by_category.get(c.id, []))
        for c in categories
        if c.is_active and by_category.get(c.id)
    ]
    ws = db.table("workspaces").select("currency").eq("id", workspace_id).limit(1).execute()
    code = (ws.data[0].get("currency") if ws.data else None) or currency_mod.DEFAULT_CURRENCY
    return KioskMenu(
        categories=out,
        currency_symbol=currency_mod.symbol_for(code),
        currency_decimals=currency_mod.decimals_for(code),
    )


def _place_tap_order(
    db, workspace_id: str, location_id: str | None, body: ManualOrderBody, source: str
) -> ManualOrderResult:
    """Place a tap order (kiosk or phone). Prices come from the DB — the request
    carries only ids — and it reuses the same order path the voice agent uses."""
    item_ids = [line.item_id for line in body.items]
    items_res = (
        db.table("menu_items")
        .select("id, name, is_active")
        .eq("workspace_id", workspace_id)
        .in_("id", item_ids)
        .execute()
    )
    items_by_id = {r["id"]: r for r in (items_res.data or []) if r.get("is_active")}

    option_ids = [oid for line in body.items for oid in line.option_ids]
    options_by_id: dict[str, dict] = {}
    if option_ids:
        opts_res = (
            db.table("menu_modifier_options")
            .select("id, name")
            .in_("id", option_ids)
            .execute()
        )
        options_by_id = {r["id"]: r for r in (opts_res.data or [])}

    tool_items: list[dict] = []
    for line in body.items:
        item = items_by_id.get(line.item_id)
        if not item:
            continue
        names = [options_by_id[o]["name"] for o in line.option_ids if o in options_by_id]
        tool_items.append({"name": item["name"], "quantity": line.quantity, "modifiers": names})

    if not tool_items:
        raise AppError("None of those items are available right now.")

    result = voice_order_service.place_order_from_tool_call(
        workspace_id=workspace_id,
        location_id=location_id,
        conversation_id=None,
        customer_id=None,
        customer_phone=None,
        arguments={
            "items": tool_items,
            "fulfillment": "pickup",
            "special_instructions": f"Placed via {source}",
        },
        assign_token=True,
    )
    if not result.get("success"):
        raise AppError(result.get("message") or "Could not place the order.")

    order_token = result.get("order_token")
    log.info(
        "tap_order_placed",
        workspace_id=workspace_id,
        source=source,
        order_id=result.get("order_id"),
        order_token=order_token,
        lines=len(tool_items),
    )
    order_id = str(result.get("order_id") or "")
    if order_id:
        total = result.get("total_dollars")
        notification_service.notify_workspace_order(
            workspace_id=workspace_id,
            order_id=order_id,
            title="New order received",
            body=f"{len(tool_items)} item(s)" + (f" · ${total:.2f}" if total else ""),
        )
    return ManualOrderResult(
        success=True,
        order_id=str(result.get("order_id")) if result.get("order_id") else None,
        order_number=str(order_token) if order_token else None,
        total=result.get("total_dollars") and f"${result['total_dollars']:.2f}",
    )


@public_router.get(
    "/kiosk/{token}/menu",
    response_model=DataResponse[KioskMenu],
)
async def get_kiosk_menu(token: Annotated[str, Path()]) -> DataResponse[KioskMenu]:
    """Menu for kiosk tap-to-order. Token-scoped, gated on manual mode."""
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]
    _require_manual_ordering(db, workspace_id, ctx.get("vertical", "restaurant"))
    return ok(_build_tap_menu(db, workspace_id))


@public_router.post(
    "/kiosk/{token}/manual-order",
    response_model=DataResponse[ManualOrderResult],
)
async def place_manual_order(
    token: Annotated[str, Path()], body: ManualOrderBody
) -> DataResponse[ManualOrderResult]:
    """Place a kiosk tap order. No AI, so no credit is consumed or checked.
    Prices come from the DB — the request carries only ids."""
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]
    _require_manual_ordering(db, workspace_id, ctx.get("vertical", "restaurant"))
    return ok(_place_tap_order(db, workspace_id, ctx["location_id"], body, "kiosk (manual)"))


# ── Phone (QR) ordering — many concurrent devices, no session lock ────────────


@public_router.get("/order/{token}/menu", response_model=DataResponse[KioskMenu])
async def get_phone_menu(token: Annotated[str, Path()]) -> DataResponse[KioskMenu]:
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]
    _require_phone_ordering(db, workspace_id, ctx.get("vertical", "restaurant"))
    return ok(_build_tap_menu(db, workspace_id))


@public_router.get("/order/{token}/info", response_model=DataResponse[PhoneOrderInfo])
async def get_phone_info(token: Annotated[str, Path()]) -> DataResponse[PhoneOrderInfo]:
    """Header info + the device-lock policy for the phone ordering page."""
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]
    _require_phone_ordering(db, workspace_id, ctx.get("vertical", "restaurant"))

    cfg = _get_ws_kiosk_settings(db, workspace_id)
    loc = db.table("locations").select("name").eq("id", ctx["location_id"]).limit(1).execute()
    ws = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()
    return ok(
        PhoneOrderInfo(
            location_name=loc.data[0]["name"] if loc.data else "",
            workspace_name=ws.data[0]["name"] if ws.data else "",
            order_lock_enabled=cfg.phone_order_lock_enabled,
            order_lock_minutes=cfg.phone_order_lock_minutes,
        )
    )


@public_router.post("/order/{token}/place", response_model=DataResponse[ManualOrderResult])
async def place_phone_order(
    token: Annotated[str, Path()], body: ManualOrderBody
) -> DataResponse[ManualOrderResult]:
    """Place a phone (QR) tap order. Not session-locked — many customers order
    at once. Free (no credit). Pickup by the returned order number."""
    db = get_supabase_admin()
    ctx = _get_kiosk_chat_context(db, token)
    workspace_id = ctx["workspace_id"]
    _require_phone_ordering(db, workspace_id, ctx.get("vertical", "restaurant"))
    return ok(_place_tap_order(db, workspace_id, ctx["location_id"], body, "phone (QR)"))


@public_router.post("/kiosk/{token}/speak")
async def kiosk_speak(
    token: Annotated[str, Path()],
    body: KioskSpeakBody,
) -> Response:
    """Convert text to speech via OpenAI tts-1 and return raw audio bytes."""
    db = get_supabase_admin()
    _get_kiosk_chat_context(db, token)

    cfg = get_settings()
    if not cfg.openai_api_key:
        raise NotFoundError("TTS not configured")

    tts_headers = {
        "Authorization": f"Bearer {cfg.openai_api_key}",
        "Content-Type": "application/json",
    }

    if body.format == "pcm":
        # Proxy OpenAI's audio through as it's generated so the client can start
        # playing on the first chunk instead of waiting for the whole clip.
        async def _pcm_stream():
            tts_t0 = time.perf_counter()
            first = True
            async with _get_http().stream(
                "POST",
                f"{cfg.openai_base_url}/audio/speech",
                headers=tts_headers,
                json={
                    "model": "tts-1",
                    "input": body.text,
                    "voice": cfg.openai_tts_voice,
                    "response_format": "pcm",
                },
            ) as resp:
                if resp.status_code != 200:
                    return  # empty stream → client falls back to mp3 / browser TTS
                async for chunk in resp.aiter_bytes():
                    if first:
                        first = False
                        log.info(
                            "kiosk_tts_ttfb_ms", ms=int((time.perf_counter() - tts_t0) * 1000)
                        )
                    yield chunk

        return StreamingResponse(_pcm_stream(), media_type="application/octet-stream")

    resp = await _get_http().post(
        f"{cfg.openai_base_url}/audio/speech",
        headers=tts_headers,
        json={
            "model": "tts-1",
            "input": body.text,
            "voice": cfg.openai_tts_voice,
            "response_format": "mp3",
        },
    )

    if resp.status_code != 200:
        raise AppError(f"TTS failed ({resp.status_code})")

    return Response(content=resp.content, media_type="audio/mpeg")
