from app.core.supabase import get_supabase_admin
from app.models.admin import AdminAuditEntry
from app.services import ticket_service


def list_entries(
    *,
    actor_type: str | None = None,
    action: str | None = None,
    workspace_id: str | None = None,
    limit: int = 100,
) -> list[AdminAuditEntry]:
    db = get_supabase_admin()
    query = db.table("audit_logs").select("*").order("created_at", desc=True).limit(limit)
    if actor_type:
        query = query.eq("actor_type", actor_type)
    if action:
        # Allow prefix match: 'ticket.' or 'admin.workspace.'
        if action.endswith("*"):
            query = query.like("action", f"{action[:-1]}%")
        else:
            query = query.eq("action", action)
    if workspace_id:
        query = query.eq("workspace_id", workspace_id)

    res = query.execute()
    rows = res.data or []
    if not rows:
        return []

    # Resolve actor info for the page
    workspace_ids = {r["workspace_id"] for r in rows if r.get("workspace_id")}
    workspace_names: dict[str, str] = {}
    if workspace_ids:
        ws_res = db.table("workspaces").select("id, name").in_("id", list(workspace_ids)).execute()
        workspace_names = {w["id"]: w["name"] for w in ws_res.data or []}

    entries: list[AdminAuditEntry] = []
    for row in rows:
        actor_name = None
        actor_email = None
        if row["actor_type"] in ("user", "admin"):
            email, name = ticket_service._user_lookup(row["actor_id"])
            actor_email = email
            actor_name = name
            if row["actor_type"] == "admin" and not actor_name:
                # Look up name from admin_users
                a = (
                    db.table("admin_users")
                    .select("full_name")
                    .eq("id", row["actor_id"])
                    .limit(1)
                    .execute()
                )
                if a.data:
                    actor_name = a.data[0]["full_name"]

        entries.append(
            AdminAuditEntry(
                id=row["id"],
                actor_type=row["actor_type"],
                actor_id=row["actor_id"],
                actor_name=actor_name,
                actor_email=actor_email,
                workspace_id=row.get("workspace_id"),
                workspace_name=workspace_names.get(row.get("workspace_id"))
                if row.get("workspace_id")
                else None,
                action=row["action"],
                resource_type=row.get("resource_type"),
                resource_id=row.get("resource_id"),
                metadata=row.get("metadata"),
                created_at=row["created_at"],
            )
        )
    return entries
