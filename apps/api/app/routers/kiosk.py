import secrets
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Path, status
from pydantic import BaseModel

from app.config import get_settings
from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["kiosk"])
public_router = APIRouter(tags=["kiosk"])


# ── Pydantic models ────────────────────────────────────────────────────────────


class KioskToken(BaseModel):
    id: str
    location_id: str
    token: str
    is_active: bool
    created_at: str
    last_used_at: str | None = None


class KioskInfo(BaseModel):
    location_name: str
    workspace_name: str
    vapi_public_key: str
    vapi_assistant_id: str


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

    # Revoke any existing active token for this location first
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


# ── Public route (no auth) ─────────────────────────────────────────────────────


@public_router.get(
    "/kiosk/{token}",
    response_model=DataResponse[KioskInfo],
)
async def get_kiosk_info(token: Annotated[str, Path()]) -> DataResponse[KioskInfo]:
    db = get_supabase_admin()

    token_res = (
        db.table("kiosk_tokens")
        .select("id, workspace_id, location_id, is_active")
        .eq("token", token)
        .limit(1)
        .execute()
    )
    if not token_res.data or not token_res.data[0]["is_active"]:
        raise NotFoundError("Kiosk not found or no longer active")

    row = token_res.data[0]
    workspace_id = row["workspace_id"]
    location_id = row["location_id"]

    # Update last_used_at
    db.table("kiosk_tokens").update(
        {"last_used_at": datetime.now(UTC).isoformat()}
    ).eq("id", row["id"]).execute()

    loc_res = (
        db.table("locations")
        .select("name")
        .eq("id", location_id)
        .limit(1)
        .execute()
    )
    ws_res = (
        db.table("workspaces")
        .select("name")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    voice_res = (
        db.table("voice_settings")
        .select("vapi_assistant_id")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    location_name = loc_res.data[0]["name"] if loc_res.data else "Restaurant"
    workspace_name = ws_res.data[0]["name"] if ws_res.data else ""
    vapi_assistant_id = (
        voice_res.data[0]["vapi_assistant_id"] if voice_res.data else ""
    ) or ""

    settings = get_settings()
    vapi_public_key = settings.vapi_public_key or ""

    if not vapi_assistant_id or not vapi_public_key:
        raise NotFoundError("Voice not configured for this location")

    return ok(
        KioskInfo(
            location_name=location_name,
            workspace_name=workspace_name,
            vapi_public_key=vapi_public_key,
            vapi_assistant_id=vapi_assistant_id,
        )
    )
