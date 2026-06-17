"""Workspace usage metering, plan limits, and admin credit grants.

Billing periods are rolling 30-day windows anchored on workspace signup
(workspaces.created_at). Bonus credits from admins never expire until consumed.
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.models.billing import (
    AdminBillingUpdate,
    AdminWorkspaceUsageRow,
    BillingPeriod,
    BillingPlan,
    CreditGrant,
    CreditGrantCreate,
    TokenUsage,
    UsageMetric,
    UsageSummary,
)
from app.services import audit_service, notification_service

log = get_logger(__name__)

_PERIOD_DAYS = 30
EventType = Literal["voice_minutes", "whatsapp_in", "whatsapp_out", "help_bot_turn"]
CreditType = Literal["voice_minutes", "whatsapp_messages", "help_bot_turns"]

_WHATSAPP_EVENT_TYPES = (
    "whatsapp_in",
    "whatsapp_out",
)
_LIMIT_NOTIFY_THRESHOLD = 0.8

_LIMIT_MESSAGES: dict[EventType, str] = {
    "voice_minutes": "voice minutes",
    "whatsapp_in": "WhatsApp messages",
    "whatsapp_out": "WhatsApp messages",
    "help_bot_turn": "help assistant turns",
}


def _parse_dt(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def get_period_bounds(workspace_created_at: str | datetime) -> tuple[datetime, datetime]:
    """Current rolling 30-day window from signup anchor."""
    anchor = _parse_dt(workspace_created_at)
    now = datetime.now(UTC)
    if now < anchor:
        return anchor, anchor + timedelta(days=_PERIOD_DAYS)
    elapsed_days = (now - anchor).total_seconds() / 86400
    period_index = int(elapsed_days // _PERIOD_DAYS)
    period_start = anchor + timedelta(days=_PERIOD_DAYS * period_index)
    period_end = anchor + timedelta(days=_PERIOD_DAYS * (period_index + 1))
    return period_start, period_end


def _period_key(start: datetime) -> str:
    return start.date().isoformat()


def _get_workspace_row(workspace_id: str) -> dict[str, Any]:
    db = get_supabase_admin()
    res = (
        db.table("workspaces")
        .select("id, name, plan, status, created_at, usage_enforcement_disabled, usage_warnings")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Workspace not found")
    return res.data[0]


def get_plan(slug: str) -> BillingPlan:
    db = get_supabase_admin()
    res = db.table("billing_plans").select("*").eq("slug", slug).limit(1).execute()
    if not res.data:
        raise NotFoundError("Billing plan not found")
    row = res.data[0]
    return BillingPlan(
        slug=row["slug"],
        name=row["name"],
        price_cents_monthly=row["price_cents_monthly"],
        voice_minutes_limit=row["voice_minutes_limit"],
        whatsapp_messages_limit=row["whatsapp_messages_limit"],
        help_bot_turns_limit=row["help_bot_turns_limit"],
        allowed_channels=row["allowed_channels"] or [],
    )


def list_plans() -> list[BillingPlan]:
    db = get_supabase_admin()
    res = db.table("billing_plans").select("*").eq("is_active", True).order("sort_order").execute()
    return [
        BillingPlan(
            slug=r["slug"],
            name=r["name"],
            price_cents_monthly=r["price_cents_monthly"],
            voice_minutes_limit=r["voice_minutes_limit"],
            whatsapp_messages_limit=r["whatsapp_messages_limit"],
            help_bot_turns_limit=r["help_bot_turns_limit"],
            allowed_channels=r["allowed_channels"] or [],
        )
        for r in res.data or []
    ]


def _sum_units(
    workspace_id: str,
    event_types: tuple[str, ...],
    period_start: datetime,
    period_end: datetime,
) -> int:
    db = get_supabase_admin()
    res = (
        db.table("usage_events")
        .select("units")
        .eq("workspace_id", workspace_id)
        .in_("event_type", list(event_types))
        .gte("created_at", period_start.isoformat())
        .lt("created_at", period_end.isoformat())
        .execute()
    )
    return sum(int(r.get("units") or 0) for r in res.data or [])


def _sum_tokens(
    workspace_id: str,
    provider: str,
    period_start: datetime,
    period_end: datetime,
) -> int:
    db = get_supabase_admin()
    res = (
        db.table("usage_events")
        .select("total_tokens")
        .eq("workspace_id", workspace_id)
        .eq("provider", provider)
        .gte("created_at", period_start.isoformat())
        .lt("created_at", period_end.isoformat())
        .execute()
    )
    return sum(int(r.get("total_tokens") or 0) for r in res.data or [])


def _bonus_remaining(workspace_id: str, credit_type: CreditType) -> int:
    db = get_supabase_admin()
    res = (
        db.table("credit_grants")
        .select("amount_remaining")
        .eq("workspace_id", workspace_id)
        .eq("credit_type", credit_type)
        .gt("amount_remaining", 0)
        .execute()
    )
    return sum(int(r.get("amount_remaining") or 0) for r in res.data or [])


def _metric(
    used: int,
    plan_limit: int | None,
    bonus: int,
) -> UsageMetric:
    if plan_limit is None:
        return UsageMetric(
            used=used,
            plan_limit=None,
            bonus_remaining=bonus,
            effective_limit=None,
            percent_used=None,
        )
    effective = plan_limit + bonus
    pct = round((used / effective) * 100, 1) if effective > 0 else 100.0
    return UsageMetric(
        used=used,
        plan_limit=plan_limit,
        bonus_remaining=bonus,
        effective_limit=effective,
        percent_used=min(pct, 999.9),
    )


def get_usage_summary(workspace_id: str) -> UsageSummary:
    ws = _get_workspace_row(workspace_id)
    plan = get_plan(ws["plan"])
    period_start, period_end = get_period_bounds(ws["created_at"])
    now = datetime.now(UTC)
    days_remaining = max(0, (period_end - now).days)

    voice_used = _sum_units(workspace_id, ("voice_minutes",), period_start, period_end)
    wa_used = _sum_units(workspace_id, _WHATSAPP_EVENT_TYPES, period_start, period_end)
    help_used = _sum_units(workspace_id, ("help_bot_turn",), period_start, period_end)

    openai_tokens = _sum_tokens(workspace_id, "openai", period_start, period_end)
    gemini_tokens = _sum_tokens(workspace_id, "gemini", period_start, period_end)

    enforcement_disabled = bool(ws.get("usage_enforcement_disabled"))

    return UsageSummary(
        plan=plan,
        period=BillingPeriod(start=period_start, end=period_end, days_remaining=days_remaining),
        voice_minutes=_metric(
            voice_used,
            plan.voice_minutes_limit,
            _bonus_remaining(workspace_id, "voice_minutes"),
        ),
        whatsapp_messages=_metric(
            wa_used,
            plan.whatsapp_messages_limit,
            _bonus_remaining(workspace_id, "whatsapp_messages"),
        ),
        help_bot_turns=_metric(
            help_used,
            plan.help_bot_turns_limit,
            _bonus_remaining(workspace_id, "help_bot_turns"),
        ),
        tokens=TokenUsage(
            openai_tokens=openai_tokens,
            gemini_tokens=gemini_tokens,
            total_tokens=openai_tokens + gemini_tokens,
        ),
        usage_enforcement_disabled=enforcement_disabled,
        enforcement_active=not enforcement_disabled,
    )


def channel_allowed(workspace_id: str, channel: str) -> bool:
    ws = _get_workspace_row(workspace_id)
    plan = get_plan(ws["plan"])
    return channel in plan.allowed_channels


def _event_credit_type(event_type: EventType) -> CreditType | None:
    if event_type == "voice_minutes":
        return "voice_minutes"
    if event_type in _WHATSAPP_EVENT_TYPES:
        return "whatsapp_messages"
    if event_type == "help_bot_turn":
        return "help_bot_turns"
    return None


def _plan_limit_for_event(plan: BillingPlan, event_type: EventType) -> int | None:
    if event_type == "voice_minutes":
        return plan.voice_minutes_limit
    if event_type in _WHATSAPP_EVENT_TYPES:
        return plan.whatsapp_messages_limit
    if event_type == "help_bot_turn":
        return plan.help_bot_turns_limit
    return None


def check_allowed(
    workspace_id: str,
    event_type: EventType,
    *,
    units: int = 1,
    channel: str | None = None,
) -> bool:
    """Return True if usage is allowed (not soft-blocked)."""
    ws = _get_workspace_row(workspace_id)
    if ws.get("usage_enforcement_disabled"):
        return True

    if channel and not channel_allowed(workspace_id, channel):
        return False

    plan = get_plan(ws["plan"])
    plan_limit = _plan_limit_for_event(plan, event_type)
    if plan_limit is None:
        return True

    period_start, period_end = get_period_bounds(ws["created_at"])
    if event_type == "voice_minutes":
        used = _sum_units(workspace_id, ("voice_minutes",), period_start, period_end)
    elif event_type in _WHATSAPP_EVENT_TYPES:
        used = _sum_units(workspace_id, _WHATSAPP_EVENT_TYPES, period_start, period_end)
    else:
        used = _sum_units(workspace_id, ("help_bot_turn",), period_start, period_end)

    credit_type = _event_credit_type(event_type)
    bonus = _bonus_remaining(workspace_id, credit_type) if credit_type else 0
    return used + units <= plan_limit + bonus


def _consume_grants(workspace_id: str, credit_type: CreditType, amount: int) -> None:
    if amount <= 0:
        return
    db = get_supabase_admin()
    grants = (
        db.table("credit_grants")
        .select("id, amount_remaining")
        .eq("workspace_id", workspace_id)
        .eq("credit_type", credit_type)
        .gt("amount_remaining", 0)
        .order("created_at")
        .execute()
    )
    remaining = amount
    for grant in grants.data or []:
        if remaining <= 0:
            break
        avail = int(grant["amount_remaining"])
        take = min(avail, remaining)
        db.table("credit_grants").update({"amount_remaining": avail - take}).eq(
            "id", grant["id"]
        ).execute()
        remaining -= take


def _maybe_consume_grants(
    workspace_id: str,
    event_type: EventType,
    units: int,
    period_start: datetime,
    period_end: datetime,
) -> None:
    plan = get_plan(_get_workspace_row(workspace_id)["plan"])
    plan_limit = _plan_limit_for_event(plan, event_type)
    if plan_limit is None:
        return

    if event_type == "voice_minutes":
        types: tuple[str, ...] = ("voice_minutes",)
    elif event_type in _WHATSAPP_EVENT_TYPES:
        types = _WHATSAPP_EVENT_TYPES
    else:
        types = ("help_bot_turn",)

    period_usage = _sum_units(workspace_id, types, period_start, period_end)
    before = period_usage - units
    if before >= plan_limit:
        over = units
    elif period_usage > plan_limit:
        over = period_usage - plan_limit
    else:
        over = 0

    credit_type = _event_credit_type(event_type)
    if over > 0 and credit_type:
        _consume_grants(workspace_id, credit_type, over)


def _notify_usage_threshold(
    workspace_id: str,
    metric_key: str,
    label: str,
    used: int,
    effective: int,
    period_start: datetime,
    ws_row: dict[str, Any],
) -> None:
    if effective <= 0:
        return
    ratio = used / effective
    pkey = _period_key(period_start)
    warnings: dict[str, Any] = dict(ws_row.get("usage_warnings") or {})
    warn_key = f"{metric_key}:{pkey}"

    if ratio >= 1.0 and warnings.get(warn_key) != "blocked":
        notification_service.notify_workspace_usage_limit(
            workspace_id=workspace_id,
            title="Usage limit reached",
            body=(
                f"Your workspace has used all included {label} for this billing period. "
                "AI channels are paused until the period resets or an admin adds credits."
            ),
            link="/settings?tab=billing",
        )
        warnings[warn_key] = "blocked"
    elif ratio >= _LIMIT_NOTIFY_THRESHOLD and warnings.get(warn_key) not in ("warned", "blocked"):
        pct = int(ratio * 100)
        notification_service.notify_workspace_usage_limit(
            workspace_id=workspace_id,
            title=f"{label.title()} at {pct}%",
            body=(
                f"You've used {used} of {effective} included {label} this period. "
                "Consider upgrading or asking support for additional credits."
            ),
            link="/settings?tab=billing",
        )
        warnings[warn_key] = "warned"

    if warnings != (ws_row.get("usage_warnings") or {}):
        db = get_supabase_admin()
        db.table("workspaces").update({"usage_warnings": warnings}).eq("id", workspace_id).execute()


def record_usage(
    *,
    workspace_id: str,
    event_type: EventType,
    units: int = 1,
    location_id: str | None = None,
    conversation_id: str | None = None,
    idempotency_key: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
    provider: Literal["openai", "gemini"] | None = None,
    metadata: dict[str, Any] | None = None,
) -> bool:
    """Insert a usage event. Returns False if idempotency_key already exists."""
    if units < 1:
        return False

    db = get_supabase_admin()
    row: dict[str, Any] = {
        "workspace_id": workspace_id,
        "location_id": location_id,
        "event_type": event_type,
        "units": units,
        "conversation_id": conversation_id,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "provider": provider,
        "metadata": metadata,
    }
    if idempotency_key:
        row["idempotency_key"] = idempotency_key

    try:
        db.table("usage_events").insert(row).execute()
    except Exception as exc:
        err = str(exc).lower()
        if idempotency_key and ("duplicate" in err or "unique" in err):
            return False
        raise

    ws = _get_workspace_row(workspace_id)
    period_start, period_end = get_period_bounds(ws["created_at"])
    _maybe_consume_grants(workspace_id, event_type, units, period_start, period_end)

    summary = get_usage_summary(workspace_id)
    labels = {
        "voice_minutes": ("voice_minutes", "voice minutes"),
        "whatsapp_in": ("whatsapp_messages", "WhatsApp messages"),
        "whatsapp_out": ("whatsapp_messages", "WhatsApp messages"),
        "help_bot_turn": ("help_bot_turns", "help assistant turns"),
    }
    key, label = labels[event_type]
    metric: UsageMetric = getattr(summary, key)
    if metric.effective_limit is not None:
        _notify_usage_threshold(
            workspace_id,
            key,
            label,
            metric.used,
            metric.effective_limit,
            period_start,
            ws,
        )

    return True


def record_voice_call_minutes(
    *,
    workspace_id: str,
    location_id: str | None,
    conversation_id: str,
    duration_seconds: int | None,
    vapi_call_id: str | None = None,
) -> None:
    if not duration_seconds or duration_seconds <= 0:
        return
    minutes = max(1, math.ceil(duration_seconds / 60))
    idem = f"voice:{conversation_id}"
    record_usage(
        workspace_id=workspace_id,
        event_type="voice_minutes",
        units=minutes,
        location_id=location_id,
        conversation_id=conversation_id,
        idempotency_key=idem,
        metadata={"duration_seconds": duration_seconds, "vapi_call_id": vapi_call_id},
    )


def list_grants(workspace_id: str) -> list[CreditGrant]:
    db = get_supabase_admin()
    res = (
        db.table("credit_grants")
        .select("*")
        .eq("workspace_id", workspace_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [CreditGrant.model_validate(r) for r in res.data or []]


def grant_credits(
    workspace_id: str,
    payload: CreditGrantCreate,
    admin_id: str,
) -> CreditGrant:
    _get_workspace_row(workspace_id)
    db = get_supabase_admin()
    res = (
        db.table("credit_grants")
        .insert(
            {
                "workspace_id": workspace_id,
                "credit_type": payload.credit_type,
                "amount_total": payload.amount,
                "amount_remaining": payload.amount,
                "reason": payload.reason,
                "granted_by_admin_id": admin_id,
            }
        )
        .execute()
    )
    if not res.data:
        raise NotFoundError("Could not create credit grant")

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="billing.credits_granted",
        resource_type="credit_grant",
        resource_id=res.data[0]["id"],
        metadata={
            "credit_type": payload.credit_type,
            "amount": payload.amount,
            "reason": payload.reason,
        },
    )
    return CreditGrant.model_validate(res.data[0])


def update_workspace_billing(
    workspace_id: str,
    payload: AdminBillingUpdate,
    admin_id: str,
) -> UsageSummary:
    changes = payload.model_dump(exclude_none=True)
    if not changes:
        return get_usage_summary(workspace_id)

    db = get_supabase_admin()
    if payload.plan is not None:
        plan_res = (
            db.table("billing_plans").select("slug").eq("slug", payload.plan).limit(1).execute()
        )
        if not plan_res.data:
            raise NotFoundError("Billing plan not found")

    res = db.table("workspaces").update(changes).eq("id", workspace_id).execute()
    if not res.data:
        raise NotFoundError("Workspace not found")

    audit_service.write(
        actor_type="admin",
        actor_id=admin_id,
        workspace_id=workspace_id,
        action="billing.workspace_updated",
        resource_type="workspace",
        resource_id=workspace_id,
        metadata=changes,
    )
    return get_usage_summary(workspace_id)


def list_admin_usage(*, limit: int = 200) -> list[AdminWorkspaceUsageRow]:
    db = get_supabase_admin()
    res = (
        db.table("workspaces")
        .select("id, name, plan, status, created_at, usage_enforcement_disabled")
        .neq("status", "deleted")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    rows: list[AdminWorkspaceUsageRow] = []
    for ws in res.data or []:
        summary = get_usage_summary(ws["id"])
        rows.append(
            AdminWorkspaceUsageRow(
                workspace_id=ws["id"],
                workspace_name=ws["name"],
                plan=ws["plan"],
                status=ws["status"],
                voice_used=summary.voice_minutes.used,
                voice_limit=summary.voice_minutes.effective_limit,
                whatsapp_used=summary.whatsapp_messages.used,
                whatsapp_limit=summary.whatsapp_messages.effective_limit,
                help_used=summary.help_bot_turns.used,
                help_limit=summary.help_bot_turns.effective_limit,
                total_tokens=summary.tokens.total_tokens,
                usage_enforcement_disabled=bool(ws.get("usage_enforcement_disabled")),
                period_end=summary.period.end,
            )
        )
    return rows


def limit_reached_message(event_type: EventType) -> str:
    label = _LIMIT_MESSAGES.get(event_type, "usage")
    return (
        f"Your workspace has reached its {label} limit for this billing period. "
        "Please contact your account owner or VOAS support."
    )
