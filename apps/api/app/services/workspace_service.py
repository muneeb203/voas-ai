import re
from datetime import UTC, datetime

from app.core.exceptions import (
    AppError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.workspace import (
    CurrentUserProfile,
    Workspace,
    WorkspaceCreate,
    WorkspaceMembership,
    WorkspaceUpdate,
)
from app.services import audit_service

log = get_logger(__name__)

SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    base = SLUG_RE.sub("-", name.lower().strip()).strip("-")
    return (base or "workspace")[:60]


def _unique_slug(base: str) -> str:
    db = get_supabase_admin()
    for i in range(25):
        candidate = base if i == 0 else f"{base}-{i + 1}"
        candidate = candidate[:60]
        existing = db.table("workspaces").select("id").eq("slug", candidate).limit(1).execute()
        if not existing.data:
            return candidate
    return f"{base}-{int(datetime.now(UTC).timestamp())}"


def create_workspace(payload: WorkspaceCreate, user_id: str, user_email: str | None) -> Workspace:
    db = get_supabase_admin()

    existing_membership = (
        db.table("workspace_members")
        .select("workspace_id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if existing_membership.data:
        raise ConflictError("You already belong to a workspace")

    slug = _unique_slug(_slugify(payload.name))

    ws_res = (
        db.table("workspaces")
        .insert(
            {
                "name": payload.name,
                "slug": slug,
                "vertical": payload.vertical,
                "plan": "professional",
            }
        )
        .execute()
    )
    if not ws_res.data:
        raise AppError("Could not create workspace")
    workspace = ws_res.data[0]
    workspace_id: str = workspace["id"]

    db.table("workspace_members").insert(
        {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "role": "owner",
            "joined_at": datetime.now(UTC).isoformat(),
        }
    ).execute()

    db.table("locations").insert(
        {
            "workspace_id": workspace_id,
            "name": payload.location_name,
            "address": payload.location_address,
            "phone": payload.location_phone,
        }
    ).execute()

    audit_service.write(
        actor_type="user",
        actor_id=user_id,
        workspace_id=workspace_id,
        action="workspace.created",
        resource_type="workspace",
        resource_id=workspace_id,
        metadata={
            "vertical": payload.vertical,
            "slug": slug,
            "actor_email": user_email,
        },
    )

    log.info("workspace_created", workspace_id=workspace_id, slug=slug, owner=user_id)

    # Auto-grant free trial credits — best-effort, never fails the signup
    try:
        from app.services import billing_service

        billing_service.grant_trial_credits(workspace_id)
    except Exception as exc:
        log.error("trial_credits_grant_failed", workspace_id=workspace_id, error=str(exc))

    if user_email:
        try:
            from app.services import email_service

            full_name: str | None = None
            auth_res = db.auth.admin.get_user_by_id(user_id)
            if auth_res and auth_res.user:
                meta = auth_res.user.user_metadata or {}
                if isinstance(meta, dict):
                    name = meta.get("full_name")
                    full_name = name if isinstance(name, str) else None

            email_service.send_welcome(
                to=user_email,
                full_name=full_name,
                workspace_name=payload.name,
            )
        except Exception as exc:
            log.error("welcome_email_failed", workspace_id=workspace_id, error=str(exc))

    return Workspace.model_validate(workspace)


def get_workspace(workspace_id: str) -> Workspace:
    db = get_supabase_admin()
    res = db.table("workspaces").select("*").eq("id", workspace_id).limit(1).execute()
    if not res.data:
        raise NotFoundError("Workspace not found")
    return Workspace.model_validate(res.data[0])


def update_workspace(workspace_id: str, payload: WorkspaceUpdate, actor_id: str) -> Workspace:
    db = get_supabase_admin()

    changes = payload.model_dump(exclude_none=True)
    if not changes:
        return get_workspace(workspace_id)

    res = db.table("workspaces").update(changes).eq("id", workspace_id).execute()
    if not res.data:
        raise NotFoundError("Workspace not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="workspace.updated",
        resource_type="workspace",
        resource_id=workspace_id,
        metadata=changes,
    )

    return Workspace.model_validate(res.data[0])


def soft_delete_workspace(workspace_id: str, actor_id: str) -> None:
    db = get_supabase_admin()
    res = db.table("workspaces").update({"status": "deleted"}).eq("id", workspace_id).execute()
    if not res.data:
        raise NotFoundError("Workspace not found")

    audit_service.write(
        actor_type="user",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action="workspace.deleted",
        resource_type="workspace",
        resource_id=workspace_id,
    )


def get_current_user_profile(user_id: str, email: str | None) -> CurrentUserProfile:
    db = get_supabase_admin()

    full_name: str | None = None
    auth_res = db.auth.admin.get_user_by_id(user_id)
    if auth_res and auth_res.user:
        meta = auth_res.user.user_metadata or {}
        if isinstance(meta, dict):
            name = meta.get("full_name")
            full_name = name if isinstance(name, str) else None

    memberships_res = (
        db.table("workspace_members")
        .select("workspace_id, role, joined_at, workspaces(*)")
        .eq("user_id", user_id)
        .execute()
    )

    memberships: list[WorkspaceMembership] = []
    for row in memberships_res.data or []:
        workspace_row = row.get("workspaces")
        if not workspace_row:
            continue
        if workspace_row.get("status") == "deleted":
            continue
        memberships.append(
            WorkspaceMembership(
                workspace_id=row["workspace_id"],
                role=row["role"],
                joined_at=row.get("joined_at"),
                workspace=Workspace.model_validate(workspace_row),
            )
        )

    return CurrentUserProfile(
        id=user_id,
        email=email,
        full_name=full_name,
        memberships=memberships,
    )


def ensure_not_only_owner(workspace_id: str, target_user_id: str) -> None:
    """Raise if removing/demoting `target_user_id` would leave the workspace ownerless."""
    db = get_supabase_admin()
    owners = (
        db.table("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .eq("role", "owner")
        .execute()
    )
    owner_ids = {m["user_id"] for m in (owners.data or [])}
    if target_user_id in owner_ids and len(owner_ids) == 1:
        raise ForbiddenError("Cannot remove or demote the last owner")
