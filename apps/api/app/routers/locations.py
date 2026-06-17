from fastapi import APIRouter, status

from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.location import Location, LocationCreate, LocationUpdate
from app.services import location_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["locations"])


@router.get(
    "/workspaces/{workspace_id}/locations",
    response_model=DataResponse[list[Location]],
)
async def list_locations(ctx: WorkspaceContextDep) -> DataResponse[list[Location]]:
    locations = location_service.list_locations(ctx.workspace_id)
    return ok(locations)


@router.post(
    "/workspaces/{workspace_id}/locations",
    response_model=DataResponse[Location],
    status_code=status.HTTP_201_CREATED,
)
async def create_location(payload: LocationCreate, ctx: OwnerContextDep) -> DataResponse[Location]:
    location = location_service.create_location(ctx.workspace_id, payload, ctx.user.id)
    return ok(location)


@router.patch(
    "/workspaces/{workspace_id}/locations/{location_id}",
    response_model=DataResponse[Location],
)
async def update_location(
    location_id: str, payload: LocationUpdate, ctx: OwnerContextDep
) -> DataResponse[Location]:
    location = location_service.update_location(ctx.workspace_id, location_id, payload, ctx.user.id)
    return ok(location)


@router.delete(
    "/workspaces/{workspace_id}/locations/{location_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_location(location_id: str, ctx: OwnerContextDep) -> None:
    location_service.delete_location(ctx.workspace_id, location_id, ctx.user.id)
