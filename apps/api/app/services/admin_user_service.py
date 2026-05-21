from datetime import datetime

from app.core.supabase import get_supabase_admin
from app.models.admin import AdminUserSummary


def list_users(*, limit: int = 200) -> list[AdminUserSummary]:
    """List all auth users with their workspace memberships.

    For V1 we list up to `limit` users without pagination — admins can use
    search to find anyone outside the page. Cursor pagination lands in V3.
    """
    db = get_supabase_admin()

    # Auth users via admin API
    res = db.auth.admin.list_users(page=1, per_page=limit)
    users = getattr(res, "users", None) or []

    user_ids = [u.id for u in users]
    if not user_ids:
        return []

    memberships_res = (
        db.table("workspace_members")
        .select("user_id, role, workspace_id, workspaces(name, slug)")
        .in_("user_id", user_ids)
        .execute()
    )

    by_user: dict[str, list[dict]] = {}
    for row in memberships_res.data or []:
        uid = row["user_id"]
        by_user.setdefault(uid, []).append(
            {
                "workspace_id": row["workspace_id"],
                "workspace_name": (row.get("workspaces") or {}).get("name"),
                "workspace_slug": (row.get("workspaces") or {}).get("slug"),
                "role": row["role"],
            }
        )

    summaries: list[AdminUserSummary] = []
    for u in users:
        meta = u.user_metadata or {}
        full_name = meta.get("full_name") if isinstance(meta, dict) else None
        app_meta = u.app_metadata or {}
        is_admin = bool(app_meta.get("is_admin")) if isinstance(app_meta, dict) else False

        last_sign_in: datetime | None = None
        if u.last_sign_in_at:
            last_sign_in = (
                u.last_sign_in_at
                if isinstance(u.last_sign_in_at, datetime)
                else datetime.fromisoformat(str(u.last_sign_in_at).replace("Z", "+00:00"))
            )

        created: datetime
        if isinstance(u.created_at, datetime):
            created = u.created_at
        else:
            created = datetime.fromisoformat(str(u.created_at).replace("Z", "+00:00"))

        summaries.append(
            AdminUserSummary(
                id=u.id,
                email=u.email,
                full_name=full_name if isinstance(full_name, str) else None,
                last_sign_in_at=last_sign_in,
                created_at=created,
                is_admin=is_admin,
                workspaces=by_user.get(u.id, []),
            )
        )
    return summaries
