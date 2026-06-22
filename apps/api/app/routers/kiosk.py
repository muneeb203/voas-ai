import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Path, status
from pydantic import BaseModel

from app.config import get_settings
from app.core.exceptions import ConflictError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["kiosk"])
public_router = APIRouter(tags=["kiosk"])

SESSION_LOCK_TTL_SECONDS = 60


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


class KioskSettingsUpdate(BaseModel):
    theme: str | None = None
    session_lock_enabled: bool | None = None


class KioskInfo(BaseModel):
    location_name: str
    workspace_name: str
    vapi_public_key: str
    vapi_assistant_id: str
    theme: str
    session_lock_enabled: bool


class SessionBody(BaseModel):
    session_id: str


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_ws_kiosk_settings(db, workspace_id: str) -> KioskSettings:
    res = (
        db.table("workspace_kiosk_settings")
        .select("theme, session_lock_enabled")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    if res.data:
        return KioskSettings(**res.data[0])
    return KioskSettings(theme="gradient", session_lock_enabled=False)


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
        .eq("is_active", True)
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

    db.table("kiosk_tokens").update(
        {"is_active": False, "revoked_at": datetime.now(UTC).isoformat()}
    ).eq("location_id", location_id).eq("workspace_id", ctx.workspace_id).eq(
        "is_active", True
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

    db.table("kiosk_tokens").update(
        {"last_used_at": datetime.now(UTC).isoformat()}
    ).eq("id", row["id"]).execute()

    loc_res = db.table("locations").select("name").eq("id", location_id).limit(1).execute()
    ws_res = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()
    voice_res = (
        db.table("voice_settings")
        .select("vapi_assistant_id")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    kiosk_cfg = _get_ws_kiosk_settings(db, workspace_id)

    location_name = loc_res.data[0]["name"] if loc_res.data else "Restaurant"
    workspace_name = ws_res.data[0]["name"] if ws_res.data else ""
    vapi_assistant_id = (voice_res.data[0]["vapi_assistant_id"] if voice_res.data else "") or ""

    cfg = get_settings()
    vapi_public_key = cfg.vapi_public_key or ""

    if not vapi_assistant_id or not vapi_public_key:
        raise NotFoundError("Voice not configured for this location")

    return ok(
        KioskInfo(
            location_name=location_name,
            workspace_name=workspace_name,
            vapi_public_key=vapi_public_key,
            vapi_assistant_id=vapi_assistant_id,
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
    cfg = _get_ws_kiosk_settings(db, row["workspace_id"])

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
    cfg = _get_ws_kiosk_settings(db, row["workspace_id"])

    if not cfg.session_lock_enabled:
        return ok({"alive": True})

    if row.get("active_session_id") != body.session_id:
        raise ConflictError("Session has been taken over by another device")

    db.table("kiosk_tokens").update(
        {"session_heartbeat_at": datetime.now(UTC).isoformat()}
    ).eq("id", row["id"]).execute()

    return ok({"alive": True})
