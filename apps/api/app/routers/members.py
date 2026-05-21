from fastapi import APIRouter, Path, status

from app.deps import CurrentUserDep, OwnerContextDep, WorkspaceContextDep
from app.models.member import (
    Invitation,
    InvitationCreate,
    InvitationLookup,
    InvitationWithUrl,
    Member,
    MemberUpdate,
)
from app.services import member_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["members"])


@router.get(
    "/workspaces/{workspace_id}/members",
    response_model=DataResponse[list[Member]],
)
async def list_members(ctx: WorkspaceContextDep) -> DataResponse[list[Member]]:
    members = member_service.list_members(ctx.workspace_id)
    return ok(members)


@router.patch(
    "/workspaces/{workspace_id}/members/{member_id}",
    response_model=DataResponse[Member],
)
async def update_member(
    member_id: str, payload: MemberUpdate, ctx: OwnerContextDep
) -> DataResponse[Member]:
    member = member_service.update_member(ctx.workspace_id, member_id, payload, ctx.user.id)
    return ok(member)


@router.delete(
    "/workspaces/{workspace_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(member_id: str, ctx: OwnerContextDep) -> None:
    member_service.remove_member(ctx.workspace_id, member_id, ctx.user.id)


# --- Invitations -------------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/invitations",
    response_model=DataResponse[list[Invitation]],
)
async def list_invitations(ctx: WorkspaceContextDep) -> DataResponse[list[Invitation]]:
    invitations = member_service.list_invitations(ctx.workspace_id)
    return ok(invitations)


@router.post(
    "/workspaces/{workspace_id}/invitations",
    response_model=DataResponse[InvitationWithUrl],
    status_code=status.HTTP_201_CREATED,
)
async def create_invitation(
    payload: InvitationCreate, ctx: OwnerContextDep
) -> DataResponse[InvitationWithUrl]:
    invitation = member_service.create_invitation(ctx.workspace_id, payload, ctx.user.id)
    return ok(invitation)


@router.delete(
    "/workspaces/{workspace_id}/invitations/{invitation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_invitation(invitation_id: str, ctx: OwnerContextDep) -> None:
    member_service.revoke_invitation(ctx.workspace_id, invitation_id, ctx.user.id)


# --- Token-based (public) ---------------------------------------------------


public_router = APIRouter(tags=["invitations"])


@public_router.get(
    "/invitations/by-token/{token}",
    response_model=DataResponse[InvitationLookup],
)
async def lookup_invitation(token: str = Path(min_length=10)) -> DataResponse[InvitationLookup]:
    invitation = member_service.lookup_invitation(token)
    return ok(invitation)


@public_router.post(
    "/invitations/by-token/{token}/accept",
    response_model=DataResponse[Invitation],
)
async def accept_invitation(
    user: CurrentUserDep, token: str = Path(min_length=10)
) -> DataResponse[Invitation]:
    invitation = member_service.accept_invitation(token, user.id, user.email)
    return ok(invitation)
