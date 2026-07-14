"""Analytics aggregation for the workspace dashboard.

The Supabase Python client doesn't expose SQL GROUP BY / EXTRACT without an
RPC, so — consistent with the rest of the codebase (see
conversation_service._ensure_message_counts) — we fetch the needed columns
scoped to the workspace + time range and aggregate in Python. Volumes here are
per-workspace and time-bounded, so this stays cheap.
"""

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta, tzinfo
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.analytics import (
    AnalyticsSummary,
    DailyCount,
    DailyRevenue,
    HourlyCount,
    TodayStats,
    TopItem,
)

log = get_logger(__name__)

# Order statuses that don't count toward revenue.
_NON_REVENUE_STATUSES = {"cancelled", "refunded"}
# Salon appointment statuses that don't count toward booked revenue.
_NON_REVENUE_SALON = {"cancelled", "no_show"}


def _vertical(db, workspace_id: str) -> str:
    res = db.table("workspaces").select("vertical").eq("id", workspace_id).limit(1).execute()
    return res.data[0]["vertical"] if res.data else "restaurant"


def _order_metrics(db, workspace_id: str, since_iso: str, tz: tzinfo) -> dict[str, Any]:
    """Restaurant: aggregate the orders table into the shared summary shape."""
    rows = (
        db.table("orders")
        .select("id, status, total_cents, items_json, created_at")
        .eq("workspace_id", workspace_id)
        .gte("created_at", since_iso)
        .execute()
    ).data or []

    by_status: dict[str, int] = defaultdict(int)
    daily_counts: dict[str, int] = defaultdict(int)
    daily_rev: dict[str, int] = defaultdict(int)
    total_rev = 0
    rev_count = 0
    item_counts: dict[str, int] = defaultdict(int)
    item_rev: dict[str, int] = defaultdict(int)

    for row in rows:
        status_val = row.get("status") or "pending"
        by_status[status_val] += 1
        created = _local(row.get("created_at"), tz)
        if created:
            daily_counts[created.date().isoformat()] += 1
        if status_val in _NON_REVENUE_STATUSES:
            continue
        total = int(row.get("total_cents") or 0)
        total_rev += total
        rev_count += 1
        if created:
            daily_rev[created.date().isoformat()] += total
        items = row.get("items_json")
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or "").strip()
                if not name:
                    continue
                quantity = int(item.get("quantity") or 1)
                unit_price = int(item.get("unit_price_cents") or 0)
                item_counts[name] += quantity
                item_rev[name] += quantity * unit_price

    top = [
        TopItem(name=name, count=count, revenue_cents=item_rev[name])
        for name, count in sorted(item_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]
    return {
        "total": len(rows),
        "by_status": dict(by_status),
        "daily_counts": daily_counts,
        "daily_rev": daily_rev,
        "total_rev": total_rev,
        "rev_count": rev_count,
        "top": top,
    }


def _appointment_metrics(
    db, workspace_id: str, since_iso: str, now_iso: str, tz: tzinfo
) -> dict[str, Any]:
    """Salon: aggregate salon_appointments (by appointment date) into the same
    summary shape — appointments as 'orders', services as 'top items'."""
    rows = (
        db.table("salon_appointments")
        .select("id, status, price_cents, service_name, starts_at")
        .eq("workspace_id", workspace_id)
        .gte("starts_at", since_iso)
        .lte("starts_at", now_iso)
        .execute()
    ).data or []

    by_status: dict[str, int] = defaultdict(int)
    daily_counts: dict[str, int] = defaultdict(int)
    daily_rev: dict[str, int] = defaultdict(int)
    total_rev = 0
    rev_count = 0
    svc_counts: dict[str, int] = defaultdict(int)
    svc_rev: dict[str, int] = defaultdict(int)

    for row in rows:
        status_val = row.get("status") or "confirmed"
        by_status[status_val] += 1
        when = _local(row.get("starts_at"), tz)
        if when:
            daily_counts[when.date().isoformat()] += 1
        if status_val in _NON_REVENUE_SALON:
            continue
        price = int(row.get("price_cents") or 0)
        total_rev += price
        rev_count += 1
        if when:
            daily_rev[when.date().isoformat()] += price
        name = str(row.get("service_name") or "").strip()
        if name:
            svc_counts[name] += 1
            svc_rev[name] += price

    top = [
        TopItem(name=name, count=count, revenue_cents=svc_rev[name])
        for name, count in sorted(svc_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]
    ]
    return {
        "total": len(rows),
        "by_status": dict(by_status),
        "daily_counts": daily_counts,
        "daily_rev": daily_rev,
        "total_rev": total_rev,
        "rev_count": rev_count,
        "top": top,
    }


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _day_key(value: str | None) -> str | None:
    dt = _parse_dt(value)
    return dt.date().isoformat() if dt else None


def _workspace_tz(db, workspace_id: str) -> tzinfo:
    """Timezone to bucket analytics by — the workspace's first location's
    timezone (SMBs have one). So "busiest hours", daily buckets, and "today"
    reflect local time, not UTC. Falls back to America/New_York, then UTC."""
    res = (
        db.table("locations")
        .select("timezone")
        .eq("workspace_id", workspace_id)
        .order("created_at")
        .limit(1)
        .execute()
    )
    tz_name = (res.data[0].get("timezone") if res.data else None) or "America/New_York"
    try:
        return ZoneInfo(tz_name)
    except (ZoneInfoNotFoundError, ValueError):
        return UTC


def _local(value: str | None, tz: tzinfo) -> datetime | None:
    dt = _parse_dt(value)
    return dt.astimezone(tz) if dt else None


def _empty_daily_range(since: datetime, now: datetime) -> list[str]:
    """Inclusive list of YYYY-MM-DD strings from `since` to `now` (UTC dates)."""
    start: date = since.date()
    end: date = now.date()
    days: list[str] = []
    cursor = start
    while cursor <= end:
        days.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return days


def get_summary(workspace_id: str, since: datetime) -> AnalyticsSummary:
    db = get_supabase_admin()
    tz = _workspace_tz(db, workspace_id)
    now = datetime.now(UTC)
    since_iso = since.isoformat()

    # --- Conversations -----------------------------------------------------
    conv_res = (
        db.table("conversations")
        .select(
            "id, channel, status, outcome, duration_seconds, sentiment, " "started_at, customer_id"
        )
        .eq("workspace_id", workspace_id)
        .gte("started_at", since_iso)
        .execute()
    )
    conversations: list[dict[str, Any]] = conv_res.data or []

    by_channel: dict[str, int] = defaultdict(int)
    by_status: dict[str, int] = defaultdict(int)
    by_outcome: dict[str, int] = defaultdict(int)
    daily_conv_counts: dict[str, int] = defaultdict(int)
    hourly_counts: dict[int, int] = defaultdict(int)
    duration_values: list[int] = []
    sentiment_values: list[float] = []
    customer_ids: set[str] = set()

    for row in conversations:
        if row.get("channel"):
            by_channel[row["channel"]] += 1
        if row.get("status"):
            by_status[row["status"]] += 1
        if row.get("outcome"):
            by_outcome[row["outcome"]] += 1

        started = _local(row.get("started_at"), tz)
        if started:
            daily_conv_counts[started.date().isoformat()] += 1
            hourly_counts[started.hour] += 1

        if row.get("duration_seconds") is not None:
            duration_values.append(int(row["duration_seconds"]))
        if row.get("sentiment") is not None:
            sentiment_values.append(float(row["sentiment"]))
        if row.get("customer_id"):
            customer_ids.add(row["customer_id"])

    avg_duration = sum(duration_values) / len(duration_values) if duration_values else None
    avg_sentiment = sum(sentiment_values) / len(sentiment_values) if sentiment_values else None

    # --- Orders / appointments (vertical-aware) ----------------------------
    if _vertical(db, workspace_id) == "salon":
        m = _appointment_metrics(db, workspace_id, since_iso, now.isoformat(), tz)
    else:
        m = _order_metrics(db, workspace_id, since_iso, tz)

    total_units = m["total"]
    orders_by_status = m["by_status"]
    daily_order_counts = m["daily_counts"]
    daily_revenue = m["daily_rev"]
    total_revenue_cents = m["total_rev"]
    revenue_order_count = m["rev_count"]
    top_menu_items = m["top"]
    avg_order_value = total_revenue_cents / revenue_order_count if revenue_order_count else None

    # --- Customers ---------------------------------------------------------
    total_customers = len(customer_ids)
    new_customers = 0
    if customer_ids:
        cust_res = (
            db.table("customers")
            .select("id, first_seen")
            .eq("workspace_id", workspace_id)
            .in_("id", list(customer_ids))
            .execute()
        )
        for row in cust_res.data or []:
            first_seen = _parse_dt(row.get("first_seen"))
            if first_seen and first_seen >= since:
                new_customers += 1
    returning_customers = total_customers - new_customers

    # --- Time series (fill gaps so charts span the full range) -------------
    day_range = _empty_daily_range(since.astimezone(tz), now.astimezone(tz))
    daily_conversations = [DailyCount(date=d, count=daily_conv_counts.get(d, 0)) for d in day_range]
    daily_orders = [DailyCount(date=d, count=daily_order_counts.get(d, 0)) for d in day_range]
    daily_revenue_cents = [DailyRevenue(date=d, cents=daily_revenue.get(d, 0)) for d in day_range]

    # --- Hourly distribution (fill 0-23) -----------------------------------
    conversations_by_hour = [HourlyCount(hour=h, count=hourly_counts.get(h, 0)) for h in range(24)]

    return AnalyticsSummary(
        total_conversations=len(conversations),
        conversations_by_channel=dict(by_channel),
        conversations_by_status=dict(by_status),
        conversations_by_outcome=dict(by_outcome),
        avg_duration_seconds=avg_duration,
        avg_sentiment=avg_sentiment,
        total_orders=total_units,
        total_revenue_cents=total_revenue_cents,
        avg_order_value_cents=avg_order_value,
        orders_by_status=dict(orders_by_status),
        total_customers=total_customers,
        new_customers=new_customers,
        returning_customers=returning_customers,
        daily_conversations=daily_conversations,
        daily_orders=daily_orders,
        daily_revenue_cents=daily_revenue_cents,
        top_menu_items=top_menu_items,
        conversations_by_hour=conversations_by_hour,
    )


def get_today_stats(workspace_id: str) -> TodayStats:
    """Lightweight stats for the current UTC day — used by the dashboard home
    stat cards. Fetches only today's rows."""
    db = get_supabase_admin()
    tz = _workspace_tz(db, workspace_id)
    start_of_day = datetime.now(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    start_iso = start_of_day.astimezone(UTC).isoformat()

    conv_res = (
        db.table("conversations")
        .select("id, sentiment")
        .eq("workspace_id", workspace_id)
        .gte("started_at", start_iso)
        .execute()
    )
    conversations: list[dict[str, Any]] = conv_res.data or []
    sentiment_values = [
        float(r["sentiment"]) for r in conversations if r.get("sentiment") is not None
    ]
    avg_sentiment_today = (
        sum(sentiment_values) / len(sentiment_values) if sentiment_values else None
    )

    if _vertical(db, workspace_id) == "salon":
        now_iso = datetime.now(UTC).isoformat()
        appts = (
            db.table("salon_appointments")
            .select("id, status, price_cents")
            .eq("workspace_id", workspace_id)
            .gte("starts_at", start_iso)
            .lte("starts_at", now_iso)
            .execute()
        ).data or []
        units_today = len(appts)
        revenue_today_cents = sum(
            int(r.get("price_cents") or 0)
            for r in appts
            if (r.get("status") or "confirmed") not in _NON_REVENUE_SALON
        )
    else:
        orders = (
            db.table("orders")
            .select("id, status, total_cents")
            .eq("workspace_id", workspace_id)
            .gte("created_at", start_iso)
            .execute()
        ).data or []
        units_today = len(orders)
        revenue_today_cents = sum(
            int(r.get("total_cents") or 0)
            for r in orders
            if (r.get("status") or "pending") not in _NON_REVENUE_STATUSES
        )

    return TodayStats(
        conversations_today=len(conversations),
        orders_today=units_today,
        revenue_today_cents=revenue_today_cents,
        avg_sentiment_today=avg_sentiment_today,
    )
