from fastapi import APIRouter, BackgroundTasks, status

from app.core.exceptions import AppError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.deps import CurrentUserDep, OwnerContextDep, WorkspaceContextDep
from app.models.workspace import (
    CurrentUserProfile,
    Workspace,
    WorkspaceCreate,
    WorkspaceUpdate,
)
from app.services import voice_service, workspace_service

log = get_logger(__name__)
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["workspaces"])


@router.get("/me", response_model=DataResponse[CurrentUserProfile])
async def get_me(user: CurrentUserDep) -> DataResponse[CurrentUserProfile]:
    profile = workspace_service.get_current_user_profile(user.id, user.email)

    # Auto-create workspace for first-time users
    if not profile.memberships:
        try:
            full_name = user.full_name or ''
            workspace_name = f"{full_name.split()[0]}'s workspace" if full_name else 'My Workspace'
            workspace_service.create_workspace(
                WorkspaceCreate(name=workspace_name),
                user.id,
                user.email
            )
            # Refresh profile after workspace creation
            profile = workspace_service.get_current_user_profile(user.id, user.email)
        except Exception as exc:
            log.error('auto_create_workspace_failed', user_id=user.id, error=str(exc))
            # Continue anyway - let user configure workspace from settings

    return ok(profile)


@router.post(
    "/workspaces",
    response_model=DataResponse[Workspace],
    status_code=status.HTTP_201_CREATED,
)
async def bootstrap_workspace(
    payload: WorkspaceCreate, user: CurrentUserDep
) -> DataResponse[Workspace]:
    try:
        workspace = workspace_service.create_workspace(payload, user.id, user.email)
        return ok(workspace)
    except Exception as exc:
        log.error("bootstrap_workspace_failed", user_id=user.id, error=str(exc))
        raise AppError("Could not create workspace. Please try again later.")


@router.get("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def get_workspace(ctx: WorkspaceContextDep) -> DataResponse[Workspace]:
    workspace = workspace_service.get_workspace(ctx.workspace_id)
    return ok(workspace)


@router.patch("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def update_workspace(
    payload: WorkspaceUpdate,
    ctx: OwnerContextDep,
    background_tasks: BackgroundTasks,
) -> DataResponse[Workspace]:
    workspace = workspace_service.update_workspace(ctx.workspace_id, payload, ctx.user.id)
    return ok(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(ctx: OwnerContextDep) -> None:
    workspace_service.soft_delete_workspace(ctx.workspace_id, ctx.user.id)
