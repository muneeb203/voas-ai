"""Salon appointment confirmations + reminders over WhatsApp/SMS.

Two entry points:
  • send_confirmation(appt)  — called inline right after a booking is created.
  • sweep()                  — run periodically by a background loop; sends any
                               reminders whose lead time has arrived.

Everything is best-effort and gated: with no Twilio/WhatsApp configured, sends
are logged and skipped, so the salon flow works unchanged. Reminder de-dup is
insert-first against appointment_reminders_sent (unique on appointment+lead), so
a restart — or a second API instance — can never double-send.
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import get_settings
from app.core.logging import get_logger
from app.core.supabase import get_supabase_admin
from app.integrations import twilio_whatsapp
from app.models.salon import SalonAppointment

log = get_logger(__name__)

_SWEEP_INTERVAL_SECONDS = 300
_PRUNE_EVERY_TICKS = 12  # 12 sweeps x 5min = roughly hourly error-log prune
_BOOKED_STATUSES = ["pending", "confirmed"]
_DEFAULT_LEAD_MINUTES = [1440]  # 24h before


# ── Settings ─────────────────────────────────────────────────────────────────


def _reminder_settings(workspace_id: str) -> dict[str, Any]:
    db = get_supabase_admin()
    res = (
        db.table("voice_settings")
        .select(
            "send_appointment_confirmations, send_appointment_reminders, reminder_lead_minutes"
        )
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )
    row = res.data[0] if res.data else {}
    return {
        "confirmations": bool(row.get("send_appointment_confirmations", True)),
        "reminders": bool(row.get("send_appointment_reminders", True)),
        "lead_minutes": [m for m in (row.get("reminder_lead_minutes") or _DEFAULT_LEAD_MINUTES) if m > 0],
    }


# ── Message building ─────────────────────────────────────────────────────────


def _location(workspace_id: str, location_id: str | None) -> dict[str, Any]:
    db = get_supabase_admin()
    q = db.table("locations").select("name, address, city, timezone").eq(
        "workspace_id", workspace_id
    )
    if location_id:
        q = q.eq("id", location_id)
    res = q.limit(1).execute()
    return res.data[0] if res.data else {}


def _workspace_name(workspace_id: str) -> str:
    db = get_supabase_admin()
    res = db.table("workspaces").select("name").eq("id", workspace_id).limit(1).execute()
    return res.data[0]["name"] if res.data else "our salon"


def _tz(tzname: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tzname or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _fmt_when(starts_at: datetime, tz: ZoneInfo) -> str:
    local = starts_at.astimezone(tz)
    # Portable formatting (no %-d / %-I — those break on Windows).
    day = local.strftime("%A, %b %d")
    hour = local.strftime("%I:%M %p").lstrip("0")
    return f"{day} at {hour}"


def _build_message(
    kind: str,  # 'confirmation' | 'reminder'
    appt: dict[str, Any],
    location: dict[str, Any],
    salon_name: str,
) -> str:
    tz = _tz(location.get("timezone"))
    starts_at = appt["starts_at"]
    if isinstance(starts_at, str):
        starts_at = datetime.fromisoformat(starts_at.replace("Z", "+00:00"))
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)

    name = appt.get("customer_name")
    greeting = f"Hi {name}! " if name else "Hi! "
    service = appt.get("service_name") or "your appointment"
    staff = appt.get("staff_name")
    with_staff = f" with {staff}" if staff else ""
    when = _fmt_when(starts_at, tz)
    addr = location.get("address")
    addr_line = f"\n📍 {addr}" if addr else ""

    if kind == "confirmation":
        headline = f"Your appointment at {salon_name} is confirmed ✅"
        footer = "See you then!"
    else:
        headline = f"Reminder — your appointment at {salon_name} is coming up"
        footer = "See you soon!"

    return (
        f"{greeting}{headline}\n\n"
        f"{service}{with_staff}\n"
        f"🗓 {when}{addr_line}\n\n"
        f"{footer}"
    )


# ── Transport (WhatsApp preferred, SMS fallback) ─────────────────────────────


def _location_whatsapp_config(workspace_id: str, location_id: str | None) -> dict[str, Any] | None:
    if not location_id:
        return None
    db = get_supabase_admin()
    res = (
        db.table("location_whatsapp_config")
        .select("twilio_account_sid, twilio_auth_token, twilio_whatsapp_number, enabled")
        .eq("location_id", location_id)
        .eq("workspace_id", workspace_id)
        .eq("enabled", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def _send(workspace_id: str, location_id: str | None, phone: str, message: str) -> bool:
    """Deliver via the location's WhatsApp, else global SMS, else stub. Returns
    True if a transport was available (even in stub mode we count it handled)."""
    config = _location_whatsapp_config(workspace_id, location_id)
    if config and config.get("twilio_account_sid") and config.get("twilio_auth_token"):
        twilio_whatsapp.send_whatsapp_message(
            to=phone,
            from_=config["twilio_whatsapp_number"],
            body=message,
            account_sid=config["twilio_account_sid"],
            auth_token=config["twilio_auth_token"],
        )
        return True

    settings = get_settings()
    if settings.twilio_account_sid and settings.twilio_auth_token and settings.twilio_sms_from_number:
        twilio_whatsapp.send_sms_message(
            to=phone,
            from_=settings.twilio_sms_from_number,
            body=message,
            account_sid=settings.twilio_account_sid,
            auth_token=settings.twilio_auth_token,
        )
        return True

    log.info("appointment_message_skipped", reason="no_transport", workspace_id=workspace_id)
    return False


# ── Confirmation (inline on booking) ─────────────────────────────────────────


def send_confirmation(appt: SalonAppointment) -> None:
    """Send the immediate booking confirmation. Never raises."""
    try:
        if not appt.customer_phone:
            return
        settings = _reminder_settings(appt.workspace_id)
        if not settings["confirmations"]:
            return

        # Idempotent stamp: only the first caller to flip null→now() sends.
        db = get_supabase_admin()
        stamped = (
            db.table("salon_appointments")
            .update({"confirmation_sent_at": datetime.now(UTC).isoformat()})
            .eq("id", appt.id)
            .is_("confirmation_sent_at", "null")
            .execute()
        )
        if not stamped.data:
            return  # already confirmed

        location = _location(appt.workspace_id, appt.location_id)
        message = _build_message(
            "confirmation", appt.model_dump(), location, _workspace_name(appt.workspace_id)
        )
        _send(appt.workspace_id, appt.location_id, appt.customer_phone, message)
        log.info("appointment_confirmation_sent", appointment_id=appt.id)
    except Exception as exc:
        log.error("appointment_confirmation_error", appointment_id=appt.id, error=str(exc))


# ── Reminder sweep (background) ──────────────────────────────────────────────


def sweep() -> None:
    """Send any reminders that are now due. Safe to run repeatedly."""
    db = get_supabase_admin()
    now = datetime.now(UTC)

    # Which workspaces have reminders on, and their configured lead offsets.
    vs = (
        db.table("voice_settings")
        .select("workspace_id, send_appointment_reminders, reminder_lead_minutes")
        .execute()
    )
    settings_by_ws: dict[str, list[int]] = {}
    for row in vs.data or []:
        if row.get("send_appointment_reminders", True):
            leads = [m for m in (row.get("reminder_lead_minutes") or _DEFAULT_LEAD_MINUTES) if m > 0]
            if leads:
                settings_by_ws[row["workspace_id"]] = leads
    # Workspaces with no voice_settings row default to reminders-on / 24h; the
    # sweep below still covers them via the fallback in the per-appointment loop.

    max_lead = max(
        [lead for leads in settings_by_ws.values() for lead in leads] + _DEFAULT_LEAD_MINUTES
    )
    horizon = now + timedelta(minutes=max_lead)

    appts = (
        db.table("salon_appointments")
        .select(
            "id, workspace_id, location_id, service_name, staff_name, "
            "customer_name, customer_phone, starts_at, status"
        )
        .in_("status", _BOOKED_STATUSES)
        .gte("starts_at", now.isoformat())
        .lte("starts_at", horizon.isoformat())
        .execute()
    )

    for appt in appts.data or []:
        if not appt.get("customer_phone"):
            continue
        try:
            _maybe_remind(db, appt, settings_by_ws, now)
        except Exception as exc:
            log.error("appointment_reminder_error", appointment_id=appt.get("id"), error=str(exc))


def _maybe_remind(
    db, appt: dict[str, Any], settings_by_ws: dict[str, list[int]], now: datetime
) -> None:
    ws_id = appt["workspace_id"]
    # No settings row → defaults (reminders on, 24h).
    leads = settings_by_ws.get(ws_id, _DEFAULT_LEAD_MINUTES)

    starts_at = datetime.fromisoformat(appt["starts_at"].replace("Z", "+00:00"))
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)

    for lead in leads:
        send_time = starts_at - timedelta(minutes=lead)
        if now < send_time or now >= starts_at:
            continue  # not yet due, or the appointment already started

        # Claim first: the unique (appointment_id, lead_minutes) constraint means
        # only one worker/instance wins, so we never double-send.
        try:
            db.table("appointment_reminders_sent").insert(
                {"appointment_id": appt["id"], "lead_minutes": lead}
            ).execute()
        except Exception:
            continue  # already claimed/sent

        location = _location(ws_id, appt.get("location_id"))
        message = _build_message("reminder", appt, location, _workspace_name(ws_id))
        _send(ws_id, appt.get("location_id"), appt["customer_phone"], message)
        log.info("appointment_reminder_sent", appointment_id=appt["id"], lead_minutes=lead)


# ── Background loop ──────────────────────────────────────────────────────────


async def run_reminder_loop() -> None:
    """Sweep for due reminders on a fixed interval until cancelled.

    Also piggybacks the error-log retention prune — it needs a periodic tick and
    this is the one we already have.
    """
    log.info("appointment_reminder_loop_started", interval_seconds=_SWEEP_INTERVAL_SECONDS)
    ticks = 0
    while True:
        try:
            await asyncio.sleep(_SWEEP_INTERVAL_SECONDS)
            await asyncio.to_thread(sweep)

            ticks += 1
            if ticks % _PRUNE_EVERY_TICKS == 0:  # ~hourly, not every sweep
                from app.services import error_log_service

                await asyncio.to_thread(error_log_service.prune)
        except asyncio.CancelledError:
            log.info("appointment_reminder_loop_stopped")
            raise
        except Exception as exc:
            log.error("appointment_reminder_loop_error", error=str(exc))
