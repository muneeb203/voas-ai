from datetime import UTC, datetime, timedelta

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.admin import AdminWorkspaceDetail, AdminWorkspaceListItem
from app.models.location import Location
from app.models.workspace import Workspace, WorkspaceStatus
from app.services import audit_service, member_service

log = get_logger(__name__)


def _last_activity() -> dict[str, str]:
    """workspace_id -> last activity timestamp, aggregated DB-side.

    Each health lookup is isolated: a missing migration should cost one column,
    not the whole workspaces list.
    """
    try:
        res = get_supabase_admin().rpc("workspace_last_activity", {}).execute()
        return {r["workspace_id"]: r["last_activity_at"] for r in (res.data or [])}
    except Exception as exc:
        log.warning("admin_last_activity_unavailable", error=str(exc))
        return {}


def _error_counts(days: int = 30) -> dict[str, int]:
    since = (datetime.now(UTC) - timedelta(days=days)).isoformat()
    try:
        res = (
            get_supabase_admin()
            .table("error_logs")
            .select("workspace_id")
            .gte("created_at", since)
            .execute()
        )
    except Exception as exc:
        log.warning("admin_error_counts_unavailable", error=str(exc))
        return {}
    counts: dict[str, int] = {}
    for row in res.data or []:
        ws = row.get("workspace_id")
        if ws:
            counts[ws] = counts.get(ws, 0) + 1
    return counts


def _voice_enabled() -> dict[str, bool]:
    try:
        res = get_supabase_admin().table("voice_settings").select("workspace_id, enabled").execute()
        return {r["workspace_id"]: bool(r.get("enabled")) for r in (res.data or [])}
    except Exception as exc:
        log.warning("admin_voice_enabled_unavailable", error=str(exc))
        return {}


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
    last_activity = _last_activity() if res.data else {}
    error_counts = _error_counts() if res.data else {}
    voice_enabled = _voice_enabled() if res.data else {}

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
            last_activity_at=last_activity.get(row["id"]),
            error_count=error_counts.get(row["id"], 0),
            voice_enabled=voice_enabled.get(row["id"], False),
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


def set_status(
    workspace_id: str, status: WorkspaceStatus, actor_id: str, *, action: str
) -> Workspace:
    db = get_supabase_admin()
    res = db.table("workspaces").update({"status": status}).eq("id", workspace_id).execute()
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
