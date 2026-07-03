import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, Path, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.config import get_settings
from app.core.exceptions import (
    AppError,
    ConflictError,
    KioskLimitError,
    NotFoundError,
)
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.voice import DEFAULT_SYSTEM_PROMPT
from app.services import voice_order_service
from app.services.voice_service import _menu_context_for_workspace
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["kiosk"])
public_router = APIRouter(tags=["kiosk"])

log = get_logger(__name__)

SESSION_LOCK_TTL_SECONDS = 60
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

KIOSK_MODIFIER = """
KIOSK MODE — in-store self-service kiosk. Rules:
- Reply in 1 sentence only. Maximum 15 words. Never exceed this.
- No phone number, name, or delivery address — always in-person counter pickup.
- No filler words ("Sure!", "Of course!", "Great choice!") — go straight to the point.
- When order is complete and confirmed, immediately call the place_order tool.
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


class KioskSettingsUpdate(BaseModel):
    theme: str | None = None
    session_lock_enabled: bool | None = None


class KioskInfo(BaseModel):
    location_name: str
    workspace_name: str
    theme: str
    session_lock_enabled: bool


class SessionBody(BaseModel):
    session_id: str


class KioskChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class KioskChatBody(BaseModel):
    messages: list[KioskChatMessage]


class KioskChatResponse(BaseModel):
    response: str
    order_confirmed: bool
    order: dict | None = None
    debug: dict | None = None  # timing/token info for the ?debug overlay


class KioskSpeakBody(BaseModel):
    text: str
    # 'pcm' streams raw 24kHz/16-bit/mono audio as OpenAI generates it (low latency,
    # played on the client's unlocked AudioContext). 'mp3' returns the full clip.
    format: Literal["mp3", "pcm"] = "mp3"


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_ws_kiosk_settings(db, workspace_id: str) -> KioskSettings:
    res = (
        db.table("workspace_kiosk_settings")
        .select(
            "theme, session_lock_enabled, kiosk_enabled, max_kiosk_urls, "
            "kiosk_monthly_limit, kiosk_credits_balance, kiosk_credits_used_this_month, kiosk_month_start"
        )
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


def _build_kiosk_system_prompt(db, workspace_id: str) -> str:
    voice_res = (
        db.table("voice_settings")
        .select("system_prompt")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    base_prompt = voice_res.data[0]["system_prompt"] if voice_res.data else DEFAULT_SYSTEM_PROMPT
    menu_md = _menu_context_for_workspace(workspace_id)
    return f"{base_prompt}\n\n{menu_md}\n\n{KIOSK_MODIFIER}".strip()


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


def _get_kiosk_chat_context(db, token: str) -> dict:
    """Cached token → {workspace_id, location_id} for the hot /chat and /speak
    paths, so the token lookup doesn't run on every turn. The kiosk is always
    available; access is gated only by the credit balance (checked in /chat)."""
    now = time.monotonic()
    cached = _kiosk_ctx_cache.get(token)
    if cached and cached[0] > now:
        return cached[1]
    row = _get_token_row(db, token)
    ctx = {"workspace_id": row["workspace_id"], "location_id": row["location_id"]}
    _kiosk_ctx_cache[token] = (now + KIOSK_CTX_TTL_SECONDS, ctx)
    return ctx


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
    ws_res = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()

    return ok(
        KioskInfo(
            location_name=loc_res.data[0]["name"] if loc_res.data else "Restaurant",
            workspace_name=ws_res.data[0]["name"] if ws_res.data else "",
            theme=kiosk_cfg.theme,
            session_lock_enabled=kiosk_cfg.session_lock_enabled,
        )
    )


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
        raise KioskLimitError(
            "This kiosk is out of credits. Contact the restaurant to add more."
        )

    system_prompt = _get_kiosk_system_prompt(db, workspace_id)
    messages_payload = [m.model_dump() for m in body.messages]

    chat_t0 = time.perf_counter()
    resp = await _get_http().post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": cfg.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 80,
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": messages_payload,
            "tools": [PLACE_ORDER_TOOL],
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
            db.rpc("decrement_kiosk_credit", {"p_workspace_id": workspace_id}).execute()

            order_id = str(placed.get("order_id") or "")
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
