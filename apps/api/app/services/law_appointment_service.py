from datetime import datetime, UTC
from app.core.supabase import get_supabase_admin
from app.models.law_appointment import LawAppointmentCreate, LawAppointment
from app.core.exceptions import AppError


def book_appointment(workspace_id: str, data: LawAppointmentCreate) -> LawAppointment:
    """Book a law appointment without staff requirements."""
    db = get_supabase_admin()
    print(f"[DEBUG] Booking appointment for workspace: {workspace_id}")
    print(f"[DEBUG] Customer: {data.customer_name}, Phone: {data.customer_phone}")

    # Parse starts_at to ensure it's valid
    try:
        starts_at = datetime.fromisoformat(data.starts_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        raise AppError("Invalid date/time format")

    # Ensure it's in UTC
    if starts_at.tzinfo is None:
        starts_at = starts_at.replace(tzinfo=UTC)
    else:
        starts_at = starts_at.astimezone(UTC)

    # 1 hour default duration for consultations
    ends_at = starts_at.replace(hour=starts_at.hour + 1)

    row = {
        "workspace_id": workspace_id,
        "service_id": data.service_id,
        "customer_name": data.customer_name,
        "customer_phone": data.customer_phone,
        "customer_email": data.customer_email,
        "starts_at": starts_at.isoformat(),
        "ends_at": ends_at.isoformat(),
        "status": "confirmed",
        "notes": data.notes,
    }

    print(f"[DEBUG] Inserting row: {row}")
    res = db.table("law_appointments").insert(row).execute()
    print(f"[DEBUG] Insert response: {res.data}")

    if not res.data:
        print(f"[DEBUG] Insert failed, no data returned")
        raise AppError("Could not save the appointment")

    print(f"[DEBUG] Successfully saved appointment: {res.data[0]['id']}")
    return LawAppointment(**res.data[0])
