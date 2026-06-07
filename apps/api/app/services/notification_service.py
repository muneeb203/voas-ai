"""In-app notifications for dashboard users (bell dropdown)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.notification import Notification, NotificationList

log = get_logger(__name__)

_INSERT_BATCH = 200


def _row_to_notification(row: dict[str, Any]) -> Notification:
    return Notification.model_validate(row)


def list_for_user(user_id: str, *, limit: int = 30) -> NotificationList:
    db = get_supabase_admin()
    cap = min(max(limit, 1), 50)

    items_res = (
        db.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(cap)
        .execute()
    )
    items = [_row_to_notification(r) for r in items_res.data or []]

    unread_res = (
        db.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )
    unread = unread_res.count if unread_res.count is not None else 0

    return NotificationList(items=items, unread_count=unread)


def mark_read(notification_id: str, user_id: str) -> Notification:
    db = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    res = (
        db.table("notifications")
        .update({"read_at": now})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not res.data:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Notification not found")
    return _row_to_notification(res.data[0])


def mark_all_read(user_id: str) -> int:
    db = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    res = (
        db.table("notifications")
        .update({"read_at": now})
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )
    return len(res.data or [])


def _insert_batch(rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    db = get_supabase_admin()
    for i in range(0, len(rows), _INSERT_BATCH):
        chunk = rows[i : i + _INSERT_BATCH]
        db.table("notifications").insert(chunk).execute()


def notify_workspace_order(
    *,
    workspace_id: str,
    order_id: str,
    title: str,
    body: str | None = None,
) -> None:
    """Fan-out an order alert to every member of the workspace."""
    db = get_supabase_admin()
    members_res = (
        db.table("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .execute()
    )
    user_ids = list({str(r["user_id"]) for r in members_res.data or [] if r.get("user_id")})
    if not user_ids:
        return

    rows = [
        {
            "user_id": uid,
            "workspace_id": workspace_id,
            "type": "order_placed",
            "title": title,
            "body": body,
            "link": f"/orders/{order_id}",
            "resource_type": "order",
            "resource_id": order_id,
        }
        for uid in user_ids
    ]
    _insert_batch(rows)
    log.info(
        "order_notifications_sent",
        workspace_id=workspace_id,
        order_id=order_id,
        recipients=len(rows),
    )


def notify_all_users_product_update(
    *,
    title: str,
    body: str,
    link: str | None,
    announcement_id: str,
) -> int:
    """Fan-out a VOAS admin announcement to every dashboard user."""
    db = get_supabase_admin()
    members_res = db.table("workspace_members").select("user_id").execute()
    user_ids = list({str(r["user_id"]) for r in members_res.data or [] if r.get("user_id")})
    if not user_ids:
        return 0

    rows = [
        {
            "user_id": uid,
            "workspace_id": None,
            "type": "product_update",
            "title": title,
            "body": body,
            "link": link,
            "resource_type": "announcement",
            "resource_id": announcement_id,
        }
        for uid in user_ids
    ]
    _insert_batch(rows)
    log.info(
        "announcement_notifications_sent",
        announcement_id=announcement_id,
        recipients=len(rows),
    )
    return len(rows)
