from datetime import UTC, datetime

from app.core.exceptions import NotFoundError
from app.core.supabase import get_supabase_admin
from app.services import audit_service


def start(workspace_id: str, admin_id: str) -> dict[str, str]:
    """Record an impersonation start and return the cookie payload.

    The cookie is set by the *frontend* server action; this backend call
    validates the workspace exists and writes the audit log entry. We do
    not generate a JWT — Next.js Server Actions hold the impersonation
    state in an HttpOnly cookie and re-validate the admin on every request.
    """
    db = get_supabase_admin()
    res = (
        db.table("workspaces").select("id, name, status").eq("id", workspace_id).limit(1).execute()
    )
    if not res.data:
        raise NotFoundError("Workspace not found")
    workspace = res.data[0]

    started_at = datetime.now(UTC).isoformat()

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="admin.impersonation.started",
        resource_type="workspace",
        resource_id=workspace_id,
        metadata={"workspace_name": workspace["name"], "started_at": started_at},
    )

    return {
        "workspace_id": workspace_id,
        "workspace_name": workspace["name"],
        "started_at": started_at,
    }


def end(workspace_id: str | None, admin_id: str) -> None:
    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="admin.impersonation.ended",
        resource_type="workspace",
        resource_id=workspace_id,
    )
