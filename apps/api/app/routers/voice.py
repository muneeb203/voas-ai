from fastapi import APIRouter, status

from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.voice import (
    LocationVoiceConfigSafe,
    LocationVoiceConfigUpsert,
    VoiceCapabilities,
    VoiceSettings,
    VoiceSettingsUpdate,
)
from app.services import voice_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["voice"])


@router.get("/voice/capabilities", response_model=DataResponse[VoiceCapabilities])
async def get_capabilities() -> DataResponse[VoiceCapabilities]:
    """Public-ish (any authed user): voice options + whether Vapi is configured.
    No workspace-scoped data — safe to call without a workspace context."""
    return ok(voice_service.get_capabilities())


@router.get(
    "/workspaces/{workspace_id}/voice/settings",
    response_model=DataResponse[VoiceSettings],
)
async def get_voice_settings(ctx: WorkspaceContextDep) -> DataResponse[VoiceSettings]:
    return ok(voice_service.get_or_create_settings(ctx.workspace_id))


@router.patch(
    "/workspaces/{workspace_id}/voice/settings",
    response_model=DataResponse[VoiceSettings],
)
async def update_voice_settings(
    payload: VoiceSettingsUpdate, ctx: OwnerContextDep
) -> DataResponse[VoiceSettings]:
    return ok(voice_service.update_settings(ctx.workspace_id, payload, ctx.user.id))


@router.get(
    "/workspaces/{workspace_id}/locations/{location_id}/voice",
    response_model=DataResponse[LocationVoiceConfigSafe | None],
)
async def get_location_voice(
    location_id: str, ctx: WorkspaceContextDep
) -> DataResponse[LocationVoiceConfigSafe | None]:
    return ok(voice_service.get_location_config(ctx.workspace_id, location_id))


@router.put(
    "/workspaces/{workspace_id}/locations/{location_id}/voice",
    response_model=DataResponse[LocationVoiceConfigSafe],
)
async def upsert_location_voice(
    location_id: str, payload: LocationVoiceConfigUpsert, ctx: OwnerContextDep
) -> DataResponse[LocationVoiceConfigSafe]:
    # Look up the location's display name for nicer Vapi labels.
    from app.core.supabase import get_supabase_admin

    db = get_supabase_admin()
    loc = (
        db.table("locations")
        .select("name")
        .eq("id", location_id)
        .eq("workspace_id", ctx.workspace_id)
        .limit(1)
        .execute()
    )
    location_name = loc.data[0]["name"] if loc.data else "Location"

    return ok(
        voice_service.upsert_location_config(
            ctx.workspace_id, location_id, payload, location_name, ctx.user.id
        )
    )


@router.delete(
    "/workspaces/{workspace_id}/locations/{location_id}/voice",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def disable_location_voice(location_id: str, ctx: OwnerContextDep) -> None:
    voice_service.disable_location_config(ctx.workspace_id, location_id, ctx.user.id)
