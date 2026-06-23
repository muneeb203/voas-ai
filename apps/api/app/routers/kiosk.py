import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, File, Path, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import get_settings
from app.core.exceptions import AppError, ConflictError, ForbiddenError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.voice import DEFAULT_SYSTEM_PROMPT
from app.services.voice_service import _menu_context_for_workspace
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["kiosk"])
public_router = APIRouter(tags=["kiosk"])

SESSION_LOCK_TTL_SECONDS = 60

KIOSK_MODIFIER = """
KIOSK MODE — the customer is ordering at an in-store self-service kiosk touchscreen.
- Do NOT ask for a phone number, full name, or delivery address — they are ordering in person.
- Do NOT offer delivery or pickup options — the order is always for in-store pickup at the counter.
- Keep every response SHORT and CONVERSATIONAL — 1 to 3 sentences maximum.
- When the customer confirms their complete order, immediately call the confirm_order tool.
"""

CONFIRM_ORDER_TOOL: dict = {
    "name": "confirm_order",
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


class KioskSpeakBody(BaseModel):
    text: str


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_ws_kiosk_settings(db, workspace_id: str) -> KioskSettings:
    res = (
        db.table("workspace_kiosk_settings")
        .select("theme, session_lock_enabled, kiosk_enabled, max_kiosk_urls")
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


def _require_kiosk_enabled(db, workspace_id: str) -> KioskSettings:
    cfg = _get_ws_kiosk_settings(db, workspace_id)
    if not cfg.kiosk_enabled:
        raise ForbiddenError("Kiosk is not enabled for this workspace")
    return cfg


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

    cfg = _get_ws_kiosk_settings(db, ctx.workspace_id)
    if not cfg.kiosk_enabled:
        raise ForbiddenError("Kiosk is not enabled for this workspace")

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

    # Count remaining active tokens for workspace
    active_res = (
        db.table("kiosk_tokens")
        .select("id")
        .eq("workspace_id", ctx.workspace_id)
        .eq("is_active", True)
        .execute()
    )
    if len(active_res.data) >= cfg.max_kiosk_urls:
        raise ConflictError(
            f"Active kiosk URL limit reached ({cfg.max_kiosk_urls}). Revoke an existing URL first."
        )

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

    kiosk_cfg = _require_kiosk_enabled(db, workspace_id)

    db.table("kiosk_tokens").update(
        {"last_used_at": datetime.now(UTC).isoformat()}
    ).eq("id", row["id"]).execute()

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
    cfg = _require_kiosk_enabled(db, row["workspace_id"])

    if not cfg.session_lock_enabled:
        return ok({"claimed": True})

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
    cfg = _require_kiosk_enabled(db, row["workspace_id"])

    if not cfg.session_lock_enabled:
        return ok({"alive": True})

    if row.get("active_session_id") != body.session_id:
        raise ConflictError("Session has been taken over by another device")

    db.table("kiosk_tokens").update(
        {"session_heartbeat_at": datetime.now(UTC).isoformat()}
    ).eq("id", row["id"]).execute()

    return ok({"alive": True})


@public_router.post(
    "/kiosk/{token}/transcribe",
    response_model=DataResponse[dict],
)
async def transcribe_kiosk_audio(
    token: Annotated[str, Path()],
    audio: UploadFile = File(...),
) -> DataResponse[dict]:
    """Receive audio blob from the kiosk, run Whisper STT, return transcript."""
    db = get_supabase_admin()
    row = _get_token_row(db, token)
    _require_kiosk_enabled(db, row["workspace_id"])

    cfg = get_settings()
    if not cfg.openai_api_key:
        raise NotFoundError("Speech-to-text not configured")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    filename = audio.filename or "recording.webm"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {cfg.openai_api_key}"},
            files={"file": (filename, audio_bytes, content_type)},
            data={"model": "whisper-1", "language": "en"},
        )

    if resp.status_code != 200:
        raise AppError(f"Transcription failed: {resp.text[:200]}")

    return ok({"transcript": resp.json().get("text", "")})


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
    row = _get_token_row(db, token)
    workspace_id = row["workspace_id"]
    _require_kiosk_enabled(db, workspace_id)

    cfg = get_settings()
    if not cfg.anthropic_api_key:
        raise NotFoundError("AI not configured")

    voice_res = (
        db.table("voice_settings")
        .select("system_prompt")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    base_prompt = voice_res.data[0]["system_prompt"] if voice_res.data else DEFAULT_SYSTEM_PROMPT
    menu_md = _menu_context_for_workspace(workspace_id)
    system_prompt = f"{base_prompt}\n\n{menu_md}\n\n{KIOSK_MODIFIER}".strip()

    messages_payload = [m.model_dump() for m in body.messages]

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": cfg.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 300,
                "system": system_prompt,
                "messages": messages_payload,
                "tools": [CONFIRM_ORDER_TOOL],
            },
        )

    if resp.status_code != 200:
        raise AppError(f"AI request failed ({resp.status_code}): {resp.text[:300]}")

    content_blocks = resp.json().get("content", [])

    for block in content_blocks:
        if block.get("type") == "tool_use" and block.get("name") == "confirm_order":
            order_input: dict = block.get("input", {})
            if not order_input.get("order_number"):
                order_input["order_number"] = f"#{1000 + (abs(hash(token)) % 9000)}"
            return ok(
                KioskChatResponse(
                    response="Your order has been confirmed! We're preparing it now.",
                    order_confirmed=True,
                    order=order_input,
                )
            )

    text = next(
        (b["text"] for b in content_blocks if b.get("type") == "text"),
        "Sorry, could you repeat that?",
    )
    return ok(KioskChatResponse(response=text, order_confirmed=False))


@public_router.post("/kiosk/{token}/speak")
async def kiosk_speak(
    token: Annotated[str, Path()],
    body: KioskSpeakBody,
) -> Response:
    """Convert text to speech via ElevenLabs and return raw audio bytes."""
    db = get_supabase_admin()
    row = _get_token_row(db, token)
    _require_kiosk_enabled(db, row["workspace_id"])

    cfg = get_settings()
    if not cfg.elevenlabs_api_key:
        raise NotFoundError("TTS not configured")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{cfg.elevenlabs_voice_id}",
            headers={
                "xi-api-key": cfg.elevenlabs_api_key,
                "Content-Type": "application/json",
            },
            json={
                "text": body.text,
                "model_id": "eleven_turbo_v2_5",
                "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
            },
        )

    if resp.status_code != 200:
        raise AppError(f"TTS failed ({resp.status_code})")

    return Response(content=resp.content, media_type="audio/mpeg")
