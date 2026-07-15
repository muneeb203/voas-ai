from datetime import UTC, datetime, timedelta

from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.services import audit_service

# Matches the admin session length (CLAUDE.md §8) and the frontend cookie maxAge.
SESSION_HOURS = 8


def start(workspace_id: str, admin_id: str, admin_user_id: str) -> dict[str, str]:
    """Record an impersonation grant and return the cookie payload.

    The grant row is what actually authorizes the admin inside the workspace —
    `get_workspace_context` checks it. It expires on its own after SESSION_HOURS,
    and `end()` closes it immediately. An admin holds at most one open grant, so
    starting a new impersonation closes any previous one.
    """
    db = get_supabase_admin()
    res = (
        db.table("workspaces").select("id, name, status").eq("id", workspace_id).limit(1).execute()
    )
    if not res.data or res.data[0]["status"] == "deleted":
        raise NotFoundError("Workspace not found")
    workspace = res.data[0]

    now = datetime.now(UTC)
    # One workspace at a time: close any grant this admin still holds.
    db.table("impersonation_sessions").update({"ended_at": now.isoformat()}).eq(
        "admin_user_id", admin_user_id
    ).is_("ended_at", "null").execute()

    db.table("impersonation_sessions").insert(
        {
            "admin_id": admin_id,
            "admin_user_id": admin_user_id,
            "workspace_id": workspace_id,
            "started_at": now.isoformat(),
            "expires_at": (now + timedelta(hours=SESSION_HOURS)).isoformat(),
        }
    ).execute()

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="admin.impersonation.started",
        resource_type="workspace",
        resource_id=workspace_id,
        metadata={"workspace_name": workspace["name"], "started_at": now.isoformat()},
    )

    return {
        "workspace_id": workspace_id,
        "workspace_name": workspace["name"],
        "started_at": now.isoformat(),
    }


def end(workspace_id: str | None, admin_id: str, admin_user_id: str) -> None:
    """Close the admin's open grant(s) so workspace access stops immediately."""
    db = get_supabase_admin()
    q = (
        db.table("impersonation_sessions")
        .update({"ended_at": datetime.now(UTC).isoformat()})
        .eq("admin_user_id", admin_user_id)
        .is_("ended_at", "null")
    )
    if workspace_id:
        q = q.eq("workspace_id", workspace_id)
    q.execute()

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="admin.impersonation.ended",
        resource_type="workspace",
        resource_id=workspace_id,
    )


def has_active_grant(admin_user_id: str, workspace_id: str) -> bool:
    """True if this admin holds a live (unexpired, unended) grant on the workspace."""
    res = (
        get_supabase_admin()
        .table("impersonation_sessions")
        .select("id")
        .eq("admin_user_id", admin_user_id)
        .eq("workspace_id", workspace_id)
        .is_("ended_at", "null")
        .gt("expires_at", datetime.now(UTC).isoformat())
        .limit(1)
        .execute()
    )
    return bool(res.data)
