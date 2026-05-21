from fastapi import APIRouter, status

from app.deps import CurrentUserDep, OwnerContextDep, WorkspaceContextDep
from app.models.workspace import (
    CurrentUserProfile,
    Workspace,
    WorkspaceCreate,
    WorkspaceUpdate,
)
from app.services import workspace_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["workspaces"])


@router.get("/me", response_model=DataResponse[CurrentUserProfile])
async def get_me(user: CurrentUserDep) -> DataResponse[CurrentUserProfile]:
    profile = workspace_service.get_current_user_profile(user.id, user.email)
    return ok(profile)


@router.post(
    "/workspaces",
    response_model=DataResponse[Workspace],
    status_code=status.HTTP_201_CREATED,
)
async def bootstrap_workspace(
    payload: WorkspaceCreate, user: CurrentUserDep
) -> DataResponse[Workspace]:
    workspace = workspace_service.create_workspace(payload, user.id, user.email)
    return ok(workspace)


@router.get("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def get_workspace(ctx: WorkspaceContextDep) -> DataResponse[Workspace]:
    workspace = workspace_service.get_workspace(ctx.workspace_id)
    return ok(workspace)


@router.patch("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def update_workspace(
    payload: WorkspaceUpdate, ctx: OwnerContextDep
) -> DataResponse[Workspace]:
    workspace = workspace_service.update_workspace(ctx.workspace_id, payload, ctx.user.id)
    return ok(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(ctx: OwnerContextDep) -> None:
    workspace_service.soft_delete_workspace(ctx.workspace_id, ctx.user.id)
