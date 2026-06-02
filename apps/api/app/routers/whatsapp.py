from fastapi import APIRouter, status

from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.whatsapp import (
    LocationWhatsAppConfigSafe,
    LocationWhatsAppConfigUpsert,
    WhatsAppCapabilities,
    WhatsAppSettings,
    WhatsAppSettingsUpdate,
)
from app.services import whatsapp_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["whatsapp"])


@router.get("/whatsapp/capabilities", response_model=DataResponse[WhatsAppCapabilities])
async def get_capabilities() -> DataResponse[WhatsAppCapabilities]:
    """Any authed user: model options + whether OpenAI/Twilio are configured.
    No workspace-scoped data — safe without a workspace context."""
    return ok(whatsapp_service.get_capabilities())


@router.get(
    "/workspaces/{workspace_id}/whatsapp/settings",
    response_model=DataResponse[WhatsAppSettings],
)
async def get_whatsapp_settings(ctx: WorkspaceContextDep) -> DataResponse[WhatsAppSettings]:
    return ok(whatsapp_service.get_or_create_settings(ctx.workspace_id))


@router.patch(
    "/workspaces/{workspace_id}/whatsapp/settings",
    response_model=DataResponse[WhatsAppSettings],
)
async def update_whatsapp_settings(
    payload: WhatsAppSettingsUpdate, ctx: OwnerContextDep
) -> DataResponse[WhatsAppSettings]:
    return ok(whatsapp_service.update_settings(ctx.workspace_id, payload, ctx.user.id))


@router.get(
    "/workspaces/{workspace_id}/locations/{location_id}/whatsapp",
    response_model=DataResponse[LocationWhatsAppConfigSafe | None],
)
async def get_location_whatsapp(
    location_id: str, ctx: WorkspaceContextDep
) -> DataResponse[LocationWhatsAppConfigSafe | None]:
    return ok(whatsapp_service.get_location_config(ctx.workspace_id, location_id))


@router.put(
    "/workspaces/{workspace_id}/locations/{location_id}/whatsapp",
    response_model=DataResponse[LocationWhatsAppConfigSafe],
)
async def upsert_location_whatsapp(
    location_id: str,
    payload: LocationWhatsAppConfigUpsert,
    ctx: OwnerContextDep,
) -> DataResponse[LocationWhatsAppConfigSafe]:
    return ok(
        whatsapp_service.upsert_location_config(
            ctx.workspace_id, location_id, payload, ctx.user.id
        )
    )


@router.delete(
    "/workspaces/{workspace_id}/locations/{location_id}/whatsapp",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def disable_location_whatsapp(location_id: str, ctx: OwnerContextDep) -> None:
    whatsapp_service.disable_location_config(ctx.workspace_id, location_id, ctx.user.id)
