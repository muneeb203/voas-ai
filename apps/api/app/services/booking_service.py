"""Salon booking engine: availability computation + conflict-safe booking.

Per-staff calendars. Staff working hours are stored as LOCAL times against the
location's timezone; appointments are stored in UTC. Availability = staff hours
minus existing appointments minus buffers. Booking re-checks the slot at commit
time so two concurrent bookings can't double-book the same staff member.
"""

import calendar
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.models.salon import (
    AvailabilityResult,
    AvailabilitySlot,
    BookAppointmentInput,
    SalonAppointment,
)
from app.services import google_calendar_service, salon_service

SLOT_STEP_MINUTES = 15
BOOKED_STATUSES = ["pending", "confirmed"]
_MIN_LEAD = timedelta(minutes=1)


def _one_month_ahead(d: date) -> date:
    """The same day one calendar month later, clamped to the month's length."""
    year = d.year + (1 if d.month == 12 else 0)
    month = 1 if d.month == 12 else d.month + 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def max_booking_date(workspace_id: str, location_id: str | None = None) -> date:
    """Latest date a salon appointment may be booked for — one month out."""
    tz = _location_tz(workspace_id, location_id)
    return _one_month_ahead(datetime.now(tz).date())


def beyond_booking_window(
    workspace_id: str, date_str: str, location_id: str | None = None
) -> bool:
    try:
        day = date.fromisoformat(date_str)
    except ValueError:
        return False
    return day > max_booking_date(workspace_id, location_id)


def _parse_time(value: str) -> time:
    parts = str(value).split(":")
    return time(int(parts[0]), int(parts[1]))


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _location_tz(workspace_id: str, location_id: str | None) -> ZoneInfo:
    db = get_supabase_admin()
    q = db.table("locations").select("timezone").eq("workspace_id", workspace_id)
    if location_id:
        q = q.eq("id", location_id)
    res = q.limit(1).execute()
    tzname = "UTC"
    if res.data and res.data[0].get("timezone"):
        tzname = res.data[0]["timezone"]
    try:
        return ZoneInfo(tzname)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def _eligible_staff(
    db, workspace_id: str, service_id: str, staff_id: str | None
) -> list[dict]:
    links = (
        db.table("salon_staff_services")
        .select("staff_id")
        .eq("service_id", service_id)
        .execute()
    )
    ids = [link["staff_id"] for link in (links.data or [])]
    if staff_id:
        ids = [i for i in ids if i == staff_id]
    if not ids:
        return []
    res = (
        db.table("salon_staff")
        .select("id, name")
        .eq("workspace_id", workspace_id)
        .eq("is_active", True)
        .in_("id", ids)
        .order("sort_order", desc=False)
        .execute()
    )
    return res.data or []


def _hours_for_weekday(db, staff_id: str, weekday: int) -> list[tuple[time, time]]:
    res = (
        db.table("salon_staff_hours")
        .select("start_time, end_time")
        .eq("staff_id", staff_id)
        .eq("weekday", weekday)
        .execute()
    )
    return [(_parse_time(r["start_time"]), _parse_time(r["end_time"])) for r in (res.data or [])]


def _busy_intervals(
    db,
    staff_id: str,
    day_start_utc: datetime,
    day_end_utc: datetime,
    exclude_appointment_id: str | None = None,
) -> list[tuple[datetime, datetime]]:
    q = (
        db.table("salon_appointments")
        .select("starts_at, ends_at")
        .eq("staff_id", staff_id)
        .in_("status", BOOKED_STATUSES)
        .gte("starts_at", day_start_utc.isoformat())
        .lt("starts_at", day_end_utc.isoformat())
    )
    if exclude_appointment_id:
        q = q.neq("id", exclude_appointment_id)
    res = q.execute()
    return [(_parse_dt(r["starts_at"]), _parse_dt(r["ends_at"])) for r in (res.data or [])]


def _overlaps(start: datetime, end: datetime, intervals: list[tuple[datetime, datetime]]) -> bool:
    return any(i_start < end and start < i_end for i_start, i_end in intervals)


def get_availability(
    workspace_id: str,
    service_id: str,
    date_str: str,
    staff_id: str | None = None,
    location_id: str | None = None,
    max_slots: int = 30,
) -> AvailabilityResult:
    db = get_supabase_admin()
    service = salon_service._get_service(workspace_id, service_id)
    duration = timedelta(minutes=service.duration_minutes)
    block = timedelta(minutes=service.duration_minutes + service.buffer_after_minutes)
    step = timedelta(minutes=SLOT_STEP_MINUTES)

    tz = _location_tz(workspace_id, location_id)
    day = date.fromisoformat(date_str)
    # Bookings are capped to one month out — nothing offered beyond that.
    if day > _one_month_ahead(datetime.now(tz).date()):
        return AvailabilityResult(date=date_str, service_id=service_id, slots=[])
    pg_dow = (day.weekday() + 1) % 7  # python Mon=0..Sun=6 → pg Sun=0..Sat=6
    now_utc = datetime.now(UTC)

    day_start_utc = datetime.combine(day, time(0, 0), tzinfo=tz).astimezone(UTC)
    day_end_utc = day_start_utc + timedelta(days=1)

    slots: list[AvailabilitySlot] = []
    for member in _eligible_staff(db, workspace_id, service_id, staff_id):
        hours = _hours_for_weekday(db, member["id"], pg_dow)
        if not hours:
            continue
        busy = _busy_intervals(db, member["id"], day_start_utc, day_end_utc)
        busy += google_calendar_service.freebusy(member["id"], day_start_utc, day_end_utc)
        for start_t, end_t in hours:
            block_start = datetime.combine(day, start_t, tzinfo=tz).astimezone(UTC)
            block_end = datetime.combine(day, end_t, tzinfo=tz).astimezone(UTC)
            cursor = block_start
            while cursor + block <= block_end:
                if cursor >= now_utc + _MIN_LEAD and not _overlaps(cursor, cursor + block, busy):
                    slots.append(
                        AvailabilitySlot(
                            starts_at=cursor,
                            ends_at=cursor + duration,
                            staff_id=member["id"],
                            staff_name=member["name"],
                        )
                    )
                cursor += step

    slots.sort(key=lambda s: (s.starts_at, s.staff_name))
    return AvailabilityResult(date=date_str, service_id=service_id, slots=slots[:max_slots])


def _slot_bookable(
    db,
    staff_id: str,
    starts_at: datetime,
    block_end: datetime,
    tz: ZoneInfo,
    exclude_appointment_id: str | None = None,
) -> bool:
    """True if [starts_at, block_end] fits a working block for the staff member
    on that weekday and doesn't overlap an existing appointment."""
    local_start = starts_at.astimezone(tz)
    pg_dow = (local_start.date().weekday() + 1) % 7
    hours = _hours_for_weekday(db, staff_id, pg_dow)
    within = False
    for start_t, end_t in hours:
        block_start = datetime.combine(local_start.date(), start_t, tzinfo=tz).astimezone(UTC)
        block_close = datetime.combine(local_start.date(), end_t, tzinfo=tz).astimezone(UTC)
        if block_start <= starts_at and block_end <= block_close:
            within = True
            break
    if not within:
        return False
    busy = _busy_intervals(
        db,
        staff_id,
        starts_at - timedelta(days=1),
        block_end + timedelta(days=1),
        exclude_appointment_id=exclude_appointment_id,
    )
    busy += google_calendar_service.freebusy(staff_id, starts_at - timedelta(days=1), block_end + timedelta(days=1))
    return not _overlaps(starts_at, block_end, busy)


def create_appointment(
    workspace_id: str, data: BookAppointmentInput, send_confirmation: bool = True
) -> SalonAppointment:
    db = get_supabase_admin()
    service = salon_service._get_service(workspace_id, service_id=data.service_id)
    if not service.is_active:
        raise AppError("That service isn't available.")

    starts_at = data.starts_at
    starts_at = starts_at if starts_at.tzinfo else starts_at.replace(tzinfo=UTC)
    starts_at = starts_at.astimezone(UTC)
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)
    block_end = starts_at + timedelta(minutes=service.duration_minutes + service.buffer_after_minutes)

    tz = _location_tz(workspace_id, data.location_id)
    if starts_at.astimezone(tz).date() > _one_month_ahead(datetime.now(tz).date()):
        raise AppError("Appointments can only be booked up to a month in advance.")

    eligible = _eligible_staff(db, workspace_id, data.service_id, data.staff_id)
    if not eligible:
        raise AppError("No staff member can perform that service.")

    chosen = next(
        (m for m in eligible if _slot_bookable(db, m["id"], starts_at, block_end, tz)),
        None,
    )
    if chosen is None:
        raise ConflictError("That time is no longer available — please pick another slot.")

    row = {
        "workspace_id": workspace_id,
        "location_id": data.location_id,
        "conversation_id": data.conversation_id,
        "staff_id": chosen["id"],
        "service_id": service.id,
        "service_name": service.name,
        "staff_name": chosen["name"],
        "customer_phone": data.customer_phone,
        "customer_name": data.customer_name,
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "status": "confirmed",
        "price_cents": service.price_cents,
        "notes": data.notes,
    }
    res = db.table("salon_appointments").insert(row).execute()
    if not res.data:
        raise AppError("Could not save the appointment.")
    appt = SalonAppointment(**res.data[0])

    event_id = google_calendar_service.push_event(
        chosen["id"],
        _event_summary(service.name, data.customer_name),
        "Booked via VOAS AI",
        starts_at,
        ends_at,
    )
    if event_id:
        db.table("salon_appointments").update({"google_event_id": event_id}).eq(
            "id", appt.id
        ).execute()
        appt.google_event_id = event_id

    if send_confirmation:
        from app.services import appointment_reminder_service

        appointment_reminder_service.send_confirmation(appt)

    from app.services import notification_service

    when = starts_at.astimezone(tz).strftime("%b %d, %I:%M %p").replace(" 0", " ")
    notification_service.notify_appointment_booked(
        workspace_id=workspace_id,
        appointment_id=appt.id,
        title="New appointment booked",
        body=f"{service.name} · {data.customer_name or 'Walk-in'} · {when}",
    )
    return appt


def _event_summary(service_name: str, customer_name: str | None) -> str:
    return f"{service_name} — {customer_name}" if customer_name else f"{service_name} — Walk-in"


def availability_prompt_context(workspace_id: str) -> str:
    """Compact services + upcoming-free-slots text for injecting into an AI
    prompt (WhatsApp or kiosk). The model offers only these real, open times;
    create_appointment re-checks at commit so stale slots can't double-book."""
    from app.services import salon_service

    services = salon_service.list_services(workspace_id, active_only=True)
    if not services:
        return "AVAILABLE APPOINTMENTS: no services configured yet."

    tz = _location_tz(workspace_id, None)
    today = datetime.now(tz).date()
    lines = [
        "SERVICES & AVAILABLE APPOINTMENTS "
        "(to book, copy service_id / starts_at / staff_id exactly):"
    ]
    for svc in services[:6]:
        slot_lines: list[str] = []
        for offset in range(0, 4):
            day = (today + timedelta(days=offset)).isoformat()
            try:
                avail = get_availability(workspace_id, svc.id, day, max_slots=4)
            except Exception:
                continue
            for slot in avail.slots:
                when = slot.starts_at.astimezone(tz).strftime("%a %b %d, %I:%M %p")
                slot_lines.append(
                    f"  - {when} with {slot.staff_name} "
                    f"[starts_at: {slot.starts_at.isoformat()} staff_id: {slot.staff_id}]"
                )
                if len(slot_lines) >= 5:
                    break
            if len(slot_lines) >= 5:
                break
        price = f"${svc.price_cents / 100:.0f}"
        lines.append(f"\n{svc.name} ({svc.duration_minutes} min, {price}) [service_id: {svc.id}]")
        lines.extend(slot_lines or ["  - no open times in the next few days"])
    return "\n".join(lines)


def reschedule_appointment(
    workspace_id: str,
    appointment_id: str,
    new_starts_at: datetime,
    staff_id: str | None = None,
) -> SalonAppointment:
    """Move an appointment to a new time (and optionally a new staff member),
    re-checking availability against everyone else's bookings."""
    from app.services import salon_service

    db = get_supabase_admin()
    appt = get_appointment(workspace_id, appointment_id)
    if not appt.service_id:
        raise AppError("This appointment can't be rescheduled.")
    service = salon_service._get_service(workspace_id, appt.service_id)

    starts_at = new_starts_at if new_starts_at.tzinfo else new_starts_at.replace(tzinfo=UTC)
    starts_at = starts_at.astimezone(UTC)
    ends_at = starts_at + timedelta(minutes=service.duration_minutes)
    block_end = starts_at + timedelta(minutes=service.duration_minutes + service.buffer_after_minutes)

    target_staff = staff_id or appt.staff_id
    if not target_staff:
        raise AppError("No staff member is assigned to this appointment.")

    eligible_ids = {m["id"] for m in _eligible_staff(db, workspace_id, appt.service_id, None)}
    if target_staff not in eligible_ids:
        raise AppError("That staff member doesn't perform this service.")

    tz = _location_tz(workspace_id, appt.location_id)
    if starts_at.astimezone(tz).date() > _one_month_ahead(datetime.now(tz).date()):
        raise AppError("Appointments can only be booked up to a month in advance.")
    if not _slot_bookable(db, target_staff, starts_at, block_end, tz, exclude_appointment_id=appointment_id):
        raise ConflictError("That time isn't available — please pick another slot.")

    staff_name = appt.staff_name
    if staff_id and staff_id != appt.staff_id:
        srow = db.table("salon_staff").select("name").eq("id", staff_id).limit(1).execute()
        staff_name = srow.data[0]["name"] if srow.data else None

    res = (
        db.table("salon_appointments")
        .update(
            {
                "starts_at": starts_at.isoformat(),
                "ends_at": ends_at.isoformat(),
                "staff_id": target_staff,
                "staff_name": staff_name,
                "status": "confirmed",
            }
        )
        .eq("workspace_id", workspace_id)
        .eq("id", appointment_id)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Appointment not found")
    updated = SalonAppointment(**res.data[0])

    summary = _event_summary(service.name, appt.customer_name)
    if target_staff != appt.staff_id:
        # Moved to a different stylist → remove the old calendar event, create a new one.
        if appt.google_event_id and appt.staff_id:
            google_calendar_service.delete_event(appt.staff_id, appt.google_event_id)
        new_event = google_calendar_service.push_event(
            target_staff, summary, "Booked via VOAS AI", starts_at, ends_at
        )
        db.table("salon_appointments").update({"google_event_id": new_event}).eq(
            "id", appointment_id
        ).execute()
        updated.google_event_id = new_event
    elif appt.google_event_id:
        google_calendar_service.update_event(
            target_staff, appt.google_event_id, summary, starts_at, ends_at
        )
    return updated


def get_appointment(workspace_id: str, appointment_id: str) -> SalonAppointment:
    db = get_supabase_admin()
    res = (
        db.table("salon_appointments")
        .select("*")
        .eq("workspace_id", workspace_id)
        .eq("id", appointment_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise NotFoundError("Appointment not found")
    return SalonAppointment(**res.data[0])
