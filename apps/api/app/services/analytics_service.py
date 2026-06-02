"""Analytics aggregation for the workspace dashboard.

The Supabase Python client doesn't expose SQL GROUP BY / EXTRACT without an
RPC, so — consistent with the rest of the codebase (see
conversation_service._ensure_message_counts) — we fetch the needed columns
scoped to the workspace + time range and aggregate in Python. Volumes here are
per-workspace and time-bounded, so this stays cheap.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any

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
    now = datetime.now(timezone.utc)
    since_iso = since.isoformat()

    # --- Conversations -----------------------------------------------------
    conv_res = (
        db.table("conversations")
        .select(
            "id, channel, status, outcome, duration_seconds, sentiment, "
            "started_at, customer_id"
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

        started = _parse_dt(row.get("started_at"))
        if started:
            daily_conv_counts[started.date().isoformat()] += 1
            hourly_counts[started.hour] += 1

        if row.get("duration_seconds") is not None:
            duration_values.append(int(row["duration_seconds"]))
        if row.get("sentiment") is not None:
            sentiment_values.append(float(row["sentiment"]))
        if row.get("customer_id"):
            customer_ids.add(row["customer_id"])

    avg_duration = (
        sum(duration_values) / len(duration_values) if duration_values else None
    )
    avg_sentiment = (
        sum(sentiment_values) / len(sentiment_values) if sentiment_values else None
    )

    # --- Orders ------------------------------------------------------------
    order_res = (
        db.table("orders")
        .select("id, status, total_cents, items_json, created_at")
        .eq("workspace_id", workspace_id)
        .gte("created_at", since_iso)
        .execute()
    )
    orders: list[dict[str, Any]] = order_res.data or []

    orders_by_status: dict[str, int] = defaultdict(int)
    daily_order_counts: dict[str, int] = defaultdict(int)
    daily_revenue: dict[str, int] = defaultdict(int)
    total_revenue_cents = 0
    revenue_order_count = 0
    item_counts: dict[str, int] = defaultdict(int)
    item_revenue: dict[str, int] = defaultdict(int)

    for row in orders:
        status_val = row.get("status") or "pending"
        orders_by_status[status_val] += 1

        created = _parse_dt(row.get("created_at"))
        if created:
            daily_order_counts[created.date().isoformat()] += 1

        is_revenue = status_val not in _NON_REVENUE_STATUSES
        total = int(row.get("total_cents") or 0)
        if is_revenue:
            total_revenue_cents += total
            revenue_order_count += 1
            if created:
                daily_revenue[created.date().isoformat()] += total

        # Aggregate line items for the top-items chart (revenue orders only).
        if is_revenue:
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
                    item_revenue[name] += quantity * unit_price

    avg_order_value = (
        total_revenue_cents / revenue_order_count if revenue_order_count else None
    )

    top_menu_items = [
        TopItem(name=name, count=count, revenue_cents=item_revenue[name])
        for name, count in sorted(
            item_counts.items(), key=lambda kv: kv[1], reverse=True
        )[:10]
    ]

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
    day_range = _empty_daily_range(since, now)
    daily_conversations = [
        DailyCount(date=d, count=daily_conv_counts.get(d, 0)) for d in day_range
    ]
    daily_orders = [
        DailyCount(date=d, count=daily_order_counts.get(d, 0)) for d in day_range
    ]
    daily_revenue_cents = [
        DailyRevenue(date=d, cents=daily_revenue.get(d, 0)) for d in day_range
    ]

    # --- Hourly distribution (fill 0-23) -----------------------------------
    conversations_by_hour = [
        HourlyCount(hour=h, count=hourly_counts.get(h, 0)) for h in range(24)
    ]

    return AnalyticsSummary(
        total_conversations=len(conversations),
        conversations_by_channel=dict(by_channel),
        conversations_by_status=dict(by_status),
        conversations_by_outcome=dict(by_outcome),
        avg_duration_seconds=avg_duration,
        avg_sentiment=avg_sentiment,
        total_orders=len(orders),
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
    start_of_day = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    start_iso = start_of_day.isoformat()

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

    order_res = (
        db.table("orders")
        .select("id, status, total_cents")
        .eq("workspace_id", workspace_id)
        .gte("created_at", start_iso)
        .execute()
    )
    orders: list[dict[str, Any]] = order_res.data or []
    revenue_today_cents = sum(
        int(r.get("total_cents") or 0)
        for r in orders
        if (r.get("status") or "pending") not in _NON_REVENUE_STATUSES
    )

    return TodayStats(
        conversations_today=len(conversations),
        orders_today=len(orders),
        revenue_today_cents=revenue_today_cents,
        avg_sentiment_today=avg_sentiment_today,
    )
