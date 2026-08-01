"""Web Push delivery for the PWA ("mobile app" notifications).

This is the OS-level counterpart to the in-app bell: it reaches a user's phone
even when the app is closed. Every function here is best-effort and MUST NOT
raise — a push failing can never break the action that triggered the underlying
notification.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin

log = get_logger(__name__)

# event key (passed by notification_service) -> settings column that gates it
_EVENT_COLUMN: dict[str, str] = {
    "order": "notify_order",
    "appointment": "notify_appointment",
    "ticket": "notify_ticket",
    "kiosk_low": "notify_kiosk_low",
    "announcement": "notify_announcement",
}


def save_subscription(
    *, user_id: str, endpoint: str, p256dh: str, auth: str, user_agent: str | None
) -> None:
    """Upsert a device subscription (unique on endpoint)."""
    db = get_supabase_admin()
    now = datetime.now(UTC).isoformat()
    db.table("push_subscriptions").upsert(
        {
            "user_id": user_id,
            "endpoint": endpoint,
            "p256dh": p256dh,
            "auth": auth,
            "user_agent": user_agent,
            "last_seen_at": now,
        },
        on_conflict="endpoint",
    ).execute()


def delete_subscription(*, user_id: str, endpoint: str) -> None:
    db = get_supabase_admin()
    db.table("push_subscriptions").delete().eq("user_id", user_id).eq(
        "endpoint", endpoint
    ).execute()


def _settings_for(workspace_id: str) -> dict[str, Any]:
    """Workspace push settings, defaulting to 'everything on' when no row yet."""
    default = {
        "push_enabled": True,
        "recipients": "owners_managers",
        "notify_order": True,
        "notify_appointment": True,
        "notify_ticket": True,
        "notify_kiosk_low": True,
        "notify_announcement": True,
    }
    try:
        db = get_supabase_admin()
        res = (
            db.table("workspace_push_settings")
            .select("*")
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return {**default, **res.data[0]}
    except Exception as exc:
        log.error("push_settings_lookup_failed", workspace_id=workspace_id, error=str(exc))
    return default


def _restrict_recipients(workspace_id: str, user_ids: list[str], recipients: str) -> list[str]:
    if recipients == "all":
        return user_ids
    # owners_managers: intersect with privileged members
    try:
        db = get_supabase_admin()
        res = (
            db.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", workspace_id)
            .in_("role", ["owner", "manager"])
            .execute()
        )
        allowed = {str(r["user_id"]) for r in res.data or [] if r.get("user_id")}
        return [u for u in user_ids if u in allowed]
    except Exception as exc:
        log.error("push_recipient_filter_failed", workspace_id=workspace_id, error=str(exc))
        return []


def send_push_to_users(
    *,
    user_ids: list[str],
    workspace_id: str | None,
    event_key: str,
    title: str,
    body: str | None,
    link: str | None,
) -> None:
    """Fan out a web push to every device of the given users, gated by the
    workspace's admin push settings. Best-effort; never raises."""
    settings = get_settings()
    if not settings.push_configured:
        return
    if not user_ids or not workspace_id:
        return

    column = _EVENT_COLUMN.get(event_key)
    if column is None:
        return  # unknown event — don't push

    try:
        cfg = _settings_for(workspace_id)
        if not cfg.get("push_enabled"):
            return
        if not cfg.get(column, True):
            return

        recipients = _restrict_recipients(workspace_id, user_ids, str(cfg.get("recipients")))
        if not recipients:
            return

        db = get_supabase_admin()
        subs_res = (
            db.table("push_subscriptions")
            .select("*")
            .in_("user_id", recipients)
            .execute()
        )
        subscriptions = subs_res.data or []
        if not subscriptions:
            return

        _deliver(subscriptions, title=title, body=body, link=link)
    except Exception as exc:
        log.error("send_push_failed", workspace_id=workspace_id, event=event_key, error=str(exc))


def _deliver(
    subscriptions: list[dict[str, Any]], *, title: str, body: str | None, link: str | None
) -> None:
    from pywebpush import WebPushException, webpush

    settings = get_settings()
    payload = json.dumps({"title": title, "body": body or "", "url": link or "/dashboard"})
    claims = {"sub": settings.vapid_subject}

    sent = 0
    stale: list[str] = []
    for sub in subscriptions:
        endpoint = sub.get("endpoint")
        if not endpoint:
            continue
        try:
            webpush(
                subscription_info={
                    "endpoint": endpoint,
                    "keys": {"p256dh": sub.get("p256dh"), "auth": sub.get("auth")},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims=dict(claims),  # webpush mutates this dict
            )
            sent += 1
        except WebPushException as exc:
            status = getattr(exc.response, "status_code", None)
            if status in (404, 410):
                stale.append(endpoint)  # subscription expired / unsubscribed
            else:
                log.warning("webpush_send_failed", status=status, error=str(exc))
        except Exception as exc:
            log.warning("webpush_send_error", error=str(exc))

    if stale:
        try:
            get_supabase_admin().table("push_subscriptions").delete().in_(
                "endpoint", stale
            ).execute()
        except Exception as exc:
            log.error("prune_stale_subscriptions_failed", error=str(exc))

    log.info("push_delivered", sent=sent, pruned=len(stale), total=len(subscriptions))
