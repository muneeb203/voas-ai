"""Per-workspace operational activity + usage history for the admin panel.

This is deliberately distinct from the audit log: audit answers "who changed
what settings", this answers "what did this business actually DO" — the calls,
chats, orders and bookings the AI handled. Read-only, service-role, admin-only.
"""

from datetime import UTC, datetime, timedelta

from app.core.supabase import get_supabase_admin
from app.models.admin import AdminActivityItem, AdminUsageHistoryPoint

_WHATSAPP_EVENTS = ("whatsapp_in", "whatsapp_out")


def _parse(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _money(cents: int | None) -> str:
    return f"${(cents or 0) / 100:.2f}"


def list_activity(workspace_id: str, limit: int = 50) -> list[AdminActivityItem]:
    """Recent conversations, orders and appointments merged into one timeline."""
    db = get_supabase_admin()
    items: list[AdminActivityItem] = []

    convs = (
        db.table("conversations")
        .select("id, channel, status, started_at, customer_phone, summary, duration_seconds")
        .eq("workspace_id", workspace_id)
        .order("started_at", desc=True)
        .limit(limit)
        .execute()
    )
    for c in convs.data or []:
        channel = (c.get("channel") or "conversation").replace("_", " ")
        secs = c.get("duration_seconds")
        duration = f" · {secs // 60}m {secs % 60}s" if isinstance(secs, int) and secs else ""
        items.append(
            AdminActivityItem(
                kind="conversation",
                id=c["id"],
                at=_parse(c["started_at"]),
                title=f"{channel.capitalize()} conversation{duration}",
                subtitle=c.get("summary") or c.get("customer_phone"),
                status=c.get("status"),
                channel=c.get("channel"),
            )
        )

    orders = (
        db.table("orders")
        .select("id, status, total_cents, customer_name, created_at, channel")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
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

    appts = (
        db.table("salon_appointments")
        .select("id, service_name, staff_name, customer_name, starts_at, status, created_at")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
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
