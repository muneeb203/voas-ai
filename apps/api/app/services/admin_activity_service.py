"""Per-workspace operational activity + usage history for the admin panel.

This is deliberately distinct from the audit log: audit answers "who changed
what settings", this answers "what did this business actually DO" — the calls,
chats, orders and bookings the AI handled. Read-only, service-role, admin-only.
"""

from datetime import UTC, datetime, timedelta
from typing import ClassVar

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.admin import (
    AdminActivityItem,
    AdminGlobalLogItem,
    AdminUsageHistoryPoint,
)

log = get_logger(__name__)

_WHATSAPP_EVENTS = ("whatsapp_in", "whatsapp_out")


class _Empty:
    """Stand-in for a query result when one source fails — lets the rest of the
    timeline render instead of blanking the whole tab."""

    data: ClassVar[list] = []


def _parse(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _money(cents: int | None) -> str:
    return f"${(cents or 0) / 100:.2f}"


def _conversations(db, workspace_id: str, limit: int):
    """cost_usd only exists once migration 00029 is applied. Fall back without
    it rather than taking the whole Activity tab down over one column."""
    base = "id, channel, status, started_at, customer_phone, summary, duration_seconds"
    try:
        return (
            db.table("conversations")
            .select(f"{base}, cost_usd")
            .eq("workspace_id", workspace_id)
            .order("started_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        log.warning("activity_cost_column_missing", error=str(exc))
        return (
            db.table("conversations")
            .select(base)
            .eq("workspace_id", workspace_id)
            .order("started_at", desc=True)
            .limit(limit)
            .execute()
        )


def list_activity(workspace_id: str, limit: int = 50) -> list[AdminActivityItem]:
    """Recent conversations, orders and appointments merged into one timeline.

    Each source is independent: if one table errors (a missing column, a schema
    drift), the others still render. A partial timeline beats a blank tab.
    """
    db = get_supabase_admin()
    items: list[AdminActivityItem] = []

    try:
        convs = _conversations(db, workspace_id, limit)
    except Exception as exc:
        log.error("activity_conversations_failed", workspace_id=workspace_id, error=str(exc))
        convs = _Empty()
    for c in convs.data or []:
        channel = (c.get("channel") or "conversation").replace("_", " ")
        secs = c.get("duration_seconds")
        duration = f" · {secs // 60}m {secs % 60}s" if isinstance(secs, int) and secs else ""
        cost = c.get("cost_usd")
        cost_label = f" · ${float(cost):.3f}" if isinstance(cost, int | float) else ""
        items.append(
            AdminActivityItem(
                kind="conversation",
                id=c["id"],
                at=_parse(c["started_at"]),
                title=f"{channel.capitalize()} conversation{duration}{cost_label}",
                subtitle=c.get("summary") or c.get("customer_phone"),
                status=c.get("status"),
                channel=c.get("channel"),
            )
        )

    try:
        orders = (
            db.table("orders")
            .select("id, status, total_cents, customer_name, created_at, channel")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        log.error("activity_orders_failed", workspace_id=workspace_id, error=str(exc))
        orders = _Empty()
    for o in orders.data or []:
        who = o.get("customer_name") or "Walk-in"
        items.append(
            AdminActivityItem(
                kind="order",
                id=o["id"],
                at=_parse(o["created_at"]),
                title=f"Order #{str(o['id'])[:8]} · {_money(o.get('total_cents'))}",
                subtitle=who,
                status=o.get("status"),
                channel=o.get("channel"),
            )
        )

    try:
        appts = (
            db.table("salon_appointments")
            .select("id, service_name, staff_name, customer_name, starts_at, status, created_at")
            .eq("workspace_id", workspace_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as exc:
        log.error("activity_appointments_failed", workspace_id=workspace_id, error=str(exc))
        appts = _Empty()
    for a in appts.data or []:
        with_staff = f" with {a['staff_name']}" if a.get("staff_name") else ""
        starts = _parse(a["starts_at"]).strftime("%b %d, %I:%M %p").replace(" 0", " ")
        items.append(
            AdminActivityItem(
                kind="appointment",
                id=a["id"],
                at=_parse(a["created_at"]),
                title=f"{a.get('service_name') or 'Appointment'}{with_staff}",
                subtitle=f"{a.get('customer_name') or 'Walk-in'} · for {starts}",
                status=a.get("status"),
            )
        )

    items.sort(key=lambda i: i.at, reverse=True)
    return items[:limit]


def _workspace_names(db) -> dict[str, str]:
    try:
        res = db.table("workspaces").select("id, name").execute()
    except Exception as exc:
        log.error("global_log_workspace_names_failed", error=str(exc))
        return {}
    return {r["id"]: r["name"] for r in res.data or []}


def _scoped(query, workspace_id: str | None):
    return query.eq("workspace_id", workspace_id) if workspace_id else query


def list_global_log(
    workspace_id: str | None = None, limit: int = 100
) -> list[AdminGlobalLogItem]:
    """The whole estate's log in one timeline, newest first.

    Same shape as a single workspace's Log tab, but unscoped by default. Each
    source is fetched independently: one bad table degrades that source's rows,
    not the page. Rows whose workspace we can't name still render — an event we
    can't attribute is exactly the kind of thing an operator needs to see.
    """
    db = get_supabase_admin()
    names = _workspace_names(db)
    items: list[AdminGlobalLogItem] = []

    def name_of(ws_id: str | None) -> str:
        if not ws_id:
            return "System"
        return names.get(ws_id, "Unknown workspace")

    def add(
        *,
        at: str | datetime,
        category: str,
        label: str,
        title: str,
        subtitle: str | None,
        ws_id: str | None,
    ) -> None:
        items.append(
            AdminGlobalLogItem(
                at=_parse(at),
                category=category,
                label=label,
                title=title,
                subtitle=subtitle,
                workspace_id=ws_id,
                workspace_name=name_of(ws_id),
            )
        )

    # --- operations: what the AI actually did ---
    try:
        convs = _scoped(
            db.table("conversations").select(
                "id, workspace_id, channel, status, started_at, customer_phone,"
                " summary, duration_seconds"
            ),
            workspace_id,
        ).order("started_at", desc=True).limit(limit).execute()
    except Exception as exc:
        log.error("global_log_conversations_failed", error=str(exc))
        convs = _Empty()
    for c in convs.data or []:
        channel = (c.get("channel") or "conversation").replace("_", " ")
        secs = c.get("duration_seconds")
        duration = f" · {secs // 60}m {secs % 60}s" if isinstance(secs, int) and secs else ""
        add(
            at=c["started_at"],
            category="operation",
            label=c.get("channel") or "conversation",
            title=f"{channel.capitalize()} conversation{duration}",
            subtitle=c.get("summary") or c.get("customer_phone"),
            ws_id=c.get("workspace_id"),
        )

    try:
        orders = _scoped(
            db.table("orders").select(
                "id, workspace_id, status, total_cents, customer_name, created_at"
            ),
            workspace_id,
        ).order("created_at", desc=True).limit(limit).execute()
    except Exception as exc:
        log.error("global_log_orders_failed", error=str(exc))
        orders = _Empty()
    for o in orders.data or []:
        add(
            at=o["created_at"],
            category="operation",
            label="order",
            title=f"Order #{str(o['id'])[:8]} · {_money(o.get('total_cents'))}",
            subtitle=o.get("customer_name") or "Walk-in",
            ws_id=o.get("workspace_id"),
        )

    try:
        appts = _scoped(
            db.table("salon_appointments").select(
                "id, workspace_id, service_name, staff_name, customer_name,"
                " starts_at, status, created_at"
            ),
            workspace_id,
        ).order("created_at", desc=True).limit(limit).execute()
    except Exception as exc:
        log.error("global_log_appointments_failed", error=str(exc))
        appts = _Empty()
    for a in appts.data or []:
        with_staff = f" with {a['staff_name']}" if a.get("staff_name") else ""
        starts = _parse(a["starts_at"]).strftime("%b %d, %I:%M %p").replace(" 0", " ")
        add(
            at=a["created_at"],
            category="operation",
            label="appointment",
            title=f"{a.get('service_name') or 'Appointment'}{with_staff}",
            subtitle=f"{a.get('customer_name') or 'Walk-in'} · for {starts}",
            ws_id=a.get("workspace_id"),
        )

    # --- config: who changed what ---
    try:
        audits = _scoped(
            db.table("audit_logs").select(
                "id, workspace_id, actor_type, action, resource_type, resource_id, created_at"
            ),
            workspace_id,
        ).order("created_at", desc=True).limit(limit).execute()
    except Exception as exc:
        log.error("global_log_audit_failed", error=str(exc))
        audits = _Empty()
    for e in audits.data or []:
        resource = e.get("resource_type")
        add(
            at=e["created_at"],
            category="config",
            label=e.get("action") or "changed",
            title=e.get("actor_type") or "system",
            subtitle=f"{resource} {e.get('resource_id') or ''}".strip() if resource else None,
            ws_id=e.get("workspace_id"),
        )

    # --- errors: what broke ---
    try:
        errors = _scoped(
            db.table("error_logs").select("id, workspace_id, kind, source, message, created_at"),
            workspace_id,
        ).order("created_at", desc=True).limit(limit).execute()
    except Exception as exc:
        log.error("global_log_errors_failed", error=str(exc))
        errors = _Empty()
    for e in errors.data or []:
        add(
            at=e["created_at"],
            category="error",
            label=e.get("kind") or "error",
            title=e.get("source") or "Unknown source",
            subtitle=e.get("message"),
            ws_id=e.get("workspace_id"),
        )

    items.sort(key=lambda i: i.at, reverse=True)
    return items[:limit]


def usage_history(workspace_id: str, days: int = 30) -> list[AdminUsageHistoryPoint]:
    """Daily usage totals for the last `days` days, zero-filled so the series
    is continuous (a gap should read as 'no usage', not 'missing')."""
    db = get_supabase_admin()
    today = datetime.now(UTC).date()
    since = datetime.now(UTC) - timedelta(days=days)

    res = (
        db.table("usage_events")
        .select("event_type, units, created_at")
        .eq("workspace_id", workspace_id)
        .gte("created_at", since.isoformat())
        .execute()
    )

    buckets: dict[str, dict[str, float]] = {}
    for row in res.data or []:
        day = str(row["created_at"])[:10]
        b = buckets.setdefault(
            day, {"voice_minutes": 0.0, "whatsapp_messages": 0.0, "help_bot_turns": 0.0}
        )
        units = float(row.get("units") or 0)
        event = row.get("event_type")
        if event == "voice_minutes":
            b["voice_minutes"] += units
        elif event in _WHATSAPP_EVENTS:
            b["whatsapp_messages"] += units
        elif event == "help_bot_turn":
            b["help_bot_turns"] += units

    out: list[AdminUsageHistoryPoint] = []
    for i in range(days - 1, -1, -1):
        day = (today - timedelta(days=i)).isoformat()
        b = buckets.get(day, {"voice_minutes": 0.0, "whatsapp_messages": 0.0, "help_bot_turns": 0.0})
        out.append(AdminUsageHistoryPoint(date=day, **b))
    return out
