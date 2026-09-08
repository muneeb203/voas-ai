from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from app.core.supabase import get_supabase_admin
from app.models.consultation_hours import ConsultationHours, ConsultationHoursDay
from app.core.exceptions import NotFoundError

SLOT_STEP_MINUTES = 15
BOOKED_STATUSES = ["pending", "confirmed"]


def get_weekday_name(weekday: int) -> str:
    """Convert Python weekday (0=Mon...6=Sun) to our key format."""
    days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    return days[weekday]


def get_consultation_hours(workspace_id: str) -> ConsultationHours:
    """Get consultation hours for a workspace."""
    db = get_supabase_admin()
    res = (
        db.table("workspace_consultation_hours")
        .select("hours")
        .eq("workspace_id", workspace_id)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise NotFoundError("Consultation hours not configured for this workspace")

    return ConsultationHours(**res.data[0]["hours"])


def get_availability_slots(
    workspace_id: str,
    date_str: str,
    max_slots: int = 30,
) -> list[dict]:
    """Compute available time slots based on consultation hours."""
    from datetime import date as date_type

    db = get_supabase_admin()

    # Get consultation hours
    hours = get_consultation_hours(workspace_id)

    # Parse date
    day = date_type.fromisoformat(date_str)
    weekday_name = get_weekday_name(day.weekday())

    # Get hours for this day
    day_hours: ConsultationHoursDay = getattr(hours, weekday_name)

    if not day_hours.enabled:
        return []

    # Get workspace timezone
    ws_res = (
        db.table("workspaces")
        .select("timezone")
        .eq("id", workspace_id)
        .limit(1)
        .execute()
    )

    tz_name = "UTC"
    if ws_res.data and ws_res.data[0].get("timezone"):
        tz_name = ws_res.data[0]["timezone"]

    try:
        tz = ZoneInfo(tz_name)
    except (ValueError, KeyError):
        tz = ZoneInfo("UTC")

    # Parse start/end times
    start_parts = day_hours.start.split(":")
    end_parts = day_hours.end.split(":")
    start_time = time(int(start_parts[0]), int(start_parts[1]))
    end_time = time(int(end_parts[0]), int(end_parts[1]))

    # Convert to UTC for availability check
    day_start_utc = datetime.combine(day, start_time, tzinfo=tz).astimezone(datetime.now(tz).tzinfo or tz)
    day_end_utc = datetime.combine(day, end_time, tzinfo=tz).astimezone(datetime.now(tz).tzinfo or tz)

    now_utc = datetime.now(ZoneInfo("UTC"))
    min_lead = timedelta(minutes=1)

    # Generate 30-minute slots
    slots = []
    current = day_start_utc
    step = timedelta(minutes=SLOT_STEP_MINUTES)
    slot_duration = timedelta(minutes=30)

    while current + slot_duration <= day_end_utc:
        if current >= now_utc + min_lead:
            slots.append({
                "starts_at": current.isoformat(),
                "ends_at": (current + slot_duration).isoformat(),
            })
        current += step

        if len(slots) >= max_slots:
            break

    return slots
