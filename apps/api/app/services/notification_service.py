"""In-app notifications for dashboard users (bell dropdown)."""

from __future__ import annotations

from datetime import UTC, datetime
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
    now = datetime.now(UTC).isoformat()
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
    """Mark every unread notification for this user as read.

    We collect the unread IDs first instead of relying on
    `update(...).execute().data` because supabase-py 2.x doesn't always
    populate the returned rows for UPDATE (depends on the PostgREST
    `Prefer: return=representation` header making it through), which would
    make the count we report back to the frontend silently wrong."""
    db = get_supabase_admin()

    unread_res = (
        db.table("notifications")
        .select("id")
        .eq("user_id", user_id)
        .is_("read_at", "null")
        .execute()
    )
    unread_ids = [r["id"] for r in unread_res.data or []]
    if not unread_ids:
        return 0

    now = datetime.now(UTC).isoformat()
    db.table("notifications").update({"read_at": now}).in_("id", unread_ids).eq(
        "user_id", user_id
    ).execute()

    log.info("notifications_mark_all_read", user_id=user_id, count=len(unread_ids))
    return len(unread_ids)


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
    """Fan-out an order alert to every member of the workspace. Never raises —
    order-placement callers don't all wrap it."""
    _notify(
        _member_ids(workspace_id),
        ntype="order_placed",
        title=title,
        body=body,
        link=f"/orders/{order_id}",
        workspace_id=workspace_id,
        resource_type="order",
        resource_id=order_id,
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


def _member_ids(workspace_id: str, roles: list[str] | None = None) -> list[str]:
    # Never raises: callers don't all wrap the notify, so a lookup failure must
    # not break the action that triggered it.
    try:
        db = get_supabase_admin()
        q = db.table("workspace_members").select("user_id").eq("workspace_id", workspace_id)
        if roles:
            q = q.in_("role", roles)
        res = q.execute()
        return list({str(r["user_id"]) for r in res.data or [] if r.get("user_id")})
    except Exception as exc:
        log.error("member_ids_lookup_failed", workspace_id=workspace_id, error=str(exc))
        return []


def _active_admin_ids() -> list[str]:
    try:
        db = get_supabase_admin()
        res = db.table("admin_users").select("user_id").eq("is_active", True).execute()
        return list({str(r["user_id"]) for r in res.data or [] if r.get("user_id")})
    except Exception as exc:
        log.error("admin_ids_lookup_failed", error=str(exc))
        return []


def _notify(
    user_ids: list[str],
    *,
    ntype: str,
    title: str,
    body: str | None,
    link: str | None,
    workspace_id: str | None,
    resource_type: str | None = None,
    resource_id: str | None = None,
) -> None:
    """Insert one notification per user. Never raises — a notification failing
    must not break the action that triggered it."""
    if not user_ids:
        return
    try:
        rows = [
            {
                "user_id": uid,
                "workspace_id": workspace_id,
                "type": ntype,
                "title": title,
                "body": body,
                "link": link,
                "resource_type": resource_type,
                "resource_id": resource_id,
            }
            for uid in user_ids
        ]
        _insert_batch(rows)
        log.info("notifications_sent", ntype=ntype, recipients=len(rows))
    except Exception as exc:
        log.error("notification_send_failed", ntype=ntype, error=str(exc))


# --- Business-user events ---------------------------------------------------


def notify_ticket_reply(*, workspace_id: str, ticket_id: str, subject: str) -> None:
    _notify(
        _member_ids(workspace_id, ["owner", "manager"]),
        ntype="ticket_reply",
        title="VOAS replied to your ticket",
        body=subject,
        link=f"/support/{ticket_id}",
        workspace_id=workspace_id,
        resource_type="ticket",
        resource_id=ticket_id,
    )


def notify_ticket_resolved(*, workspace_id: str, ticket_id: str, subject: str) -> None:
    _notify(
        _member_ids(workspace_id, ["owner", "manager"]),
        ntype="ticket_resolved",
        title="Your ticket was resolved",
        body=subject,
        link=f"/support/{ticket_id}",
        workspace_id=workspace_id,
        resource_type="ticket",
        resource_id=ticket_id,
    )


def notify_kiosk_low(*, workspace_id: str, balance: int) -> None:
    out = balance <= 0
    _notify(
        _member_ids(workspace_id, ["owner", "manager"]),
        ntype="kiosk_low",
        title="Kiosk out of service" if out else "Kiosk credits running low",
        body=(
            "Your kiosk is out of credits and no longer taking orders."
            if out
            else f"{balance} kiosk credit{'s' if balance != 1 else ''} left."
        ),
        link="/self-order",
        workspace_id=workspace_id,
        resource_type="workspace",
        resource_id=workspace_id,
    )


def notify_appointment_booked(
    *, workspace_id: str, appointment_id: str, title: str, body: str | None = None
) -> None:
    _notify(
        _member_ids(workspace_id, ["owner", "manager"]),
        ntype="appointment_booked",
        title=title,
        body=body,
        link="/appointments",
        workspace_id=workspace_id,
        resource_type="appointment",
        resource_id=appointment_id,
    )


# --- Admin-team events ------------------------------------------------------


def notify_admin_signup(*, workspace_id: str, workspace_name: str) -> None:
    _notify(
        _active_admin_ids(),
        ntype="admin_signup",
        title="New workspace signed up",
        body=workspace_name,
        link=f"/admin/workspaces/{workspace_id}",
        workspace_id=None,
        resource_type="workspace",
        resource_id=workspace_id,
    )


def notify_admin_error(*, workspace_id: str | None, source: str, message: str) -> None:
    _notify(
        _active_admin_ids(),
        ntype="admin_error",
        title=f"New error: {source}",
        body=message[:200],
        link=f"/admin/workspaces/{workspace_id}?tab=log" if workspace_id else "/admin/logs",
        workspace_id=None,
        resource_type="error",
        resource_id=workspace_id,
    )


def notify_admin_ticket(
    *, workspace_id: str, ticket_id: str, subject: str, kind: str
) -> None:
    _notify(
        _active_admin_ids(),
        ntype="admin_ticket",
        title="New support ticket" if kind == "created" else "Customer replied on a ticket",
        body=subject,
        link=f"/admin/support/{ticket_id}",
        workspace_id=None,
        resource_type="ticket",
        resource_id=ticket_id,
    )


def notify_admin_limit(*, workspace_id: str, workspace_name: str, kind: str) -> None:
    _notify(
        _active_admin_ids(),
        ntype="admin_limit",
        title="Workspace hit a limit",
        body=f"{workspace_name} — {kind}",
        link=f"/admin/workspaces/{workspace_id}",
        workspace_id=None,
        resource_type="workspace",
        resource_id=workspace_id,
    )


def notify_workspace_usage_limit(
    *,
    workspace_id: str,
    title: str,
    body: str | None = None,
    link: str = "/settings?tab=billing",
) -> None:
    """Alert workspace owners and managers about usage thresholds."""
    db = get_supabase_admin()
    members_res = (
        db.table("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace_id)
        .in_("role", ["owner", "manager"])
        .execute()
    )
    user_ids = list({str(r["user_id"]) for r in members_res.data or [] if r.get("user_id")})
    if not user_ids:
        return

    rows = [
        {
            "user_id": uid,
            "workspace_id": workspace_id,
            "type": "usage_limit",
            "title": title,
            "body": body,
            "link": link,
            "resource_type": "workspace",
            "resource_id": workspace_id,
        }
        for uid in user_ids
    ]
    _insert_batch(rows)
    log.info(
        "usage_limit_notifications_sent",
        workspace_id=workspace_id,
        recipients=len(rows),
    )
