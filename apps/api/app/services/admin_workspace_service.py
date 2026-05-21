from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.admin import AdminWorkspaceDetail, AdminWorkspaceListItem
from app.models.location import Location
from app.models.member import Member
from app.models.workspace import Workspace, WorkspaceStatus
from app.services import audit_service, member_service


def _list_with_counts() -> dict[str, dict[str, int]]:
    db = get_supabase_admin()
    counts: dict[str, dict[str, int]] = {}

    members = db.table("workspace_members").select("workspace_id").execute()
    for row in members.data or []:
        ws = row["workspace_id"]
        counts.setdefault(ws, {"member_count": 0, "location_count": 0, "open_ticket_count": 0})
        counts[ws]["member_count"] += 1

    locations = db.table("locations").select("workspace_id").execute()
    for row in locations.data or []:
        ws = row["workspace_id"]
        counts.setdefault(ws, {"member_count": 0, "location_count": 0, "open_ticket_count": 0})
        counts[ws]["location_count"] += 1

    tickets = (
        db.table("support_tickets")
        .select("workspace_id, status")
        .in_("status", ["open", "in_progress", "waiting_user"])
        .execute()
    )
    for row in tickets.data or []:
        ws = row["workspace_id"]
        counts.setdefault(ws, {"member_count": 0, "location_count": 0, "open_ticket_count": 0})
        counts[ws]["open_ticket_count"] += 1

    return counts


def list_workspaces(
    *,
    search: str | None = None,
    status: WorkspaceStatus | None = None,
    plan: str | None = None,
    limit: int = 100,
) -> list[AdminWorkspaceListItem]:
    db = get_supabase_admin()
    query = db.table("workspaces").select("*").order("created_at", desc=True).limit(limit)
    if search:
        # Postgres ilike via PostgREST; matches name or slug.
        query = query.or_(f"name.ilike.%{search}%,slug.ilike.%{search}%")
    if status:
        query = query.eq("status", status)
    if plan:
        query = query.eq("plan", plan)

    res = query.execute()
    counts = _list_with_counts() if res.data else {}

    return [
        AdminWorkspaceListItem(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            plan=row["plan"],
            vertical=row["vertical"],
            status=row["status"],
            member_count=counts.get(row["id"], {}).get("member_count", 0),
            location_count=counts.get(row["id"], {}).get("location_count", 0),
            open_ticket_count=counts.get(row["id"], {}).get("open_ticket_count", 0),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
        for row in res.data or []
    ]


def get_detail(workspace_id: str) -> AdminWorkspaceDetail:
    db = get_supabase_admin()
    ws_res = db.table("workspaces").select("*").eq("id", workspace_id).limit(1).execute()
    if not ws_res.data:
        raise NotFoundError("Workspace not found")
    workspace = Workspace.model_validate(ws_res.data[0])

    members = member_service.list_members(workspace_id)

    locs_res = (
        db.table("locations")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=False)
        .execute()
    )
    locations = [Location.model_validate(row) for row in locs_res.data or []]

    return AdminWorkspaceDetail(workspace=workspace, members=members, locations=locations)


def set_status(workspace_id: str, status: WorkspaceStatus, actor_id: str, *, action: str) -> Workspace:
    db = get_supabase_admin()
    res = (
        db.table("workspaces").update({"status": status}).eq("id", workspace_id).execute()
    )
    if not res.data:
        raise NotFoundError("Workspace not found")

    audit_service.write(
        actor_type="admin",
        actor_id=actor_id,
        workspace_id=workspace_id,
        action=action,
        resource_type="workspace",
        resource_id=workspace_id,
        metadata={"status": status},
    )
    return Workspace.model_validate(res.data[0])


def suspend(workspace_id: str, actor_id: str) -> Workspace:
    return set_status(workspace_id, "suspended", actor_id, action="admin.workspace.suspended")


def restore(workspace_id: str, actor_id: str) -> Workspace:
    return set_status(workspace_id, "active", actor_id, action="admin.workspace.restored")


def soft_delete(workspace_id: str, actor_id: str) -> None:
    set_status(workspace_id, "deleted", actor_id, action="admin.workspace.deleted")
