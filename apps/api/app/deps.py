from typing import Annotated, Literal

from fastapi import Depends, Header, Path
from pydantic import BaseModel

from app.core.exceptions import ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import decode_supabase_jwt
from app.core.supabase import get_supabase_admin

MemberRole = Literal["owner", "manager", "staff"]


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    is_admin: bool = False
    raw_claims: dict[str, object]


class WorkspaceContext(BaseModel):
    """Resolved workspace + caller's role within it."""

    user: CurrentUser
    workspace_id: str
    role: MemberRole


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise UnauthorizedError("Missing or malformed Authorization header")
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    token = _extract_bearer(authorization)
    claims = decode_supabase_jwt(token)

    sub = claims.get("sub")
    if not isinstance(sub, str):
        raise UnauthorizedError("Token missing subject")

    app_metadata = claims.get("app_metadata") or {}
    is_admin = bool(app_metadata.get("is_admin")) if isinstance(app_metadata, dict) else False

    email_value = claims.get("email")
    email = email_value if isinstance(email_value, str) else None

    return CurrentUser(id=sub, email=email, is_admin=is_admin, raw_claims=claims)


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


async def get_workspace_context(
    workspace_id: Annotated[str, Path()],
    user: CurrentUserDep,
) -> WorkspaceContext:
    """Resolve the caller's role inside `workspace_id`. 404 if the workspace
    doesn't exist, 403 if the user isn't a member. Admins do NOT bypass here
    on purpose — admin endpoints have their own surface under /v1/admin/*.
    """
    db = get_supabase_admin()
    ws = (
        db.table("workspaces")
        .select("id, status")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    if not ws.data:
        raise NotFoundError("Workspace not found")
    if ws.data[0]["status"] == "deleted":
        raise NotFoundError("Workspace not found")

    membership = (
        db.table("workspace_members")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not membership.data:
        raise ForbiddenError("You do not have access to this workspace")

    return WorkspaceContext(
        user=user,
        workspace_id=workspace_id,
        role=membership.data[0]["role"],
    )


WorkspaceContextDep = Annotated[WorkspaceContext, Depends(get_workspace_context)]


def require_owner(ctx: WorkspaceContextDep) -> WorkspaceContext:
    if ctx.role != "owner":
        raise ForbiddenError("Only workspace owners can do this")
    return ctx


OwnerContextDep = Annotated[WorkspaceContext, Depends(require_owner)]


class AdminContext(BaseModel):
    user: CurrentUser
    admin_id: str
    full_name: str
    role: Literal["admin", "super_admin"]


async def get_current_admin(user: CurrentUserDep) -> AdminContext:
    """Require the caller to be a provisioned admin.

    Checks both layers:
    1. JWT has `app_metadata.is_admin == true` (set by provisioning script)
    2. There's an active `admin_users` row for this user

    Both must agree. If they don't, treat as forbidden — defense in depth
    in case the JWT claim was set but the admin row was revoked.
    """
    if not user.is_admin:
        raise ForbiddenError("Admin access required")

    db = get_supabase_admin()
    res = (
        db.table("admin_users")
        .select("id, full_name, role, is_active")
        .eq("user_id", user.id)
        .limit(1)
        .execute()
    )
    if not res.data or not res.data[0]["is_active"]:
        raise ForbiddenError("Admin access required")

    row = res.data[0]
    return AdminContext(
        user=user,
        admin_id=row["id"],
        full_name=row["full_name"],
        role=row["role"],
    )


AdminContextDep = Annotated[AdminContext, Depends(get_current_admin)]
