"""Dental booking engine: availability computation + conflict-safe booking.

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
from app.models.dental import (
	AvailabilityResult,
	AvailabilitySlot,
	AppointmentStatusUpdate,
	BookAppointmentInput,
	DentalAppointment,
	DentalService,
	DentalServiceCreate,
	DentalServiceUpdate,
	DentalStaff,
	DentalStaffCreate,
	DentalStaffUpdate,
)

SLOT_STEP_MINUTES = 15
BOOKED_STATUSES = ["pending", "confirmed"]
_MIN_LEAD = timedelta(minutes=1)


def _check_dental_vertical(workspace_id: str) -> None:
	"""Verify workspace is a dental vertical. Raises AppError if not."""
	db = get_supabase_admin()
	ws = (
		db.table("workspaces")
		.select("vertical")
		.eq("id", workspace_id)
		.limit(1)
		.execute()
	)
	if not ws.data or ws.data[0].get("vertical") != "dental":
		raise AppError("INVALID_VERTICAL", "Appointments are only available for dental workspaces.")


def _one_month_ahead(d: date) -> date:
	"""The same day one calendar month later, clamped to the month's length."""
	year = d.year + (1 if d.month == 12 else 0)
	month = 1 if d.month == 12 else d.month + 1
	last_day = calendar.monthrange(year, month)[1]
	return date(year, month, min(d.day, last_day))


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


def _parse_time(value: str) -> time:
	parts = str(value).split(":")
	return time(int(parts[0]), int(parts[1]))


def _parse_dt(value: str) -> datetime:
	dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
	return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _get_service(workspace_id: str, service_id: str) -> DentalService:
	db = get_supabase_admin()
	res = (
		db.table("dental_services")
		.select("*")
		.eq("workspace_id", workspace_id)
		.eq("id", service_id)
		.limit(1)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Service not found")
	return DentalService(**res.data[0])


def _eligible_staff(
	db, workspace_id: str, service_id: str, staff_id: str | None
) -> list[dict]:
	links = (
		db.table("dental_staff_services")
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
		db.table("dental_staff")
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
		db.table("dental_staff_hours")
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
		db.table("dental_appointments")
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


# --- Public API ----------------------------------------------------------


def list_services(workspace_id: str, active_only: bool = False) -> list[DentalService]:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	q = (
		db.table("dental_services")
		.select("*")
		.eq("workspace_id", workspace_id)
		.order("sort_order")
	)
	if active_only:
		q = q.eq("is_active", True)
	res = q.execute()
	return [DentalService(**row) for row in res.data or []]


def list_staff(workspace_id: str, active_only: bool = False) -> list[DentalStaff]:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	q = (
		db.table("dental_staff")
		.select("*")
		.eq("workspace_id", workspace_id)
		.order("sort_order")
	)
	if active_only:
		q = q.eq("is_active", True)
	res = q.execute()
	return [DentalStaff(**row) for row in res.data or []]


def get_availability(
	workspace_id: str,
	service_id: str,
	date_str: str,
	staff_id: str | None = None,
	location_id: str | None = None,
	max_slots: int = 30,
) -> AvailabilityResult:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	service = _get_service(workspace_id, service_id)
	duration = timedelta(minutes=service.duration_minutes)
	block = timedelta(minutes=service.duration_minutes + service.buffer_after_minutes)
	step = timedelta(minutes=SLOT_STEP_MINUTES)

	tz = _location_tz(workspace_id, location_id)
	day = date.fromisoformat(date_str)
	if day > _one_month_ahead(datetime.now(tz).date()):
		return AvailabilityResult(date=date_str, service_id=service_id, slots=[])
	pg_dow = (day.weekday() + 1) % 7
	now_utc = datetime.now(UTC)

	day_start_utc = datetime.combine(day, time(0, 0), tzinfo=tz).astimezone(UTC)
	day_end_utc = day_start_utc + timedelta(days=1)

	slots: list[AvailabilitySlot] = []
	for member in _eligible_staff(db, workspace_id, service_id, staff_id):
		hours = _hours_for_weekday(db, member["id"], pg_dow)
		if not hours:
			continue
		busy = _busy_intervals(db, member["id"], day_start_utc, day_end_utc)
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


def create_appointment(
	workspace_id: str, data: BookAppointmentInput
) -> DentalAppointment:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	service = _get_service(workspace_id, data.service_id)
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

	pg_dow = (starts_at.astimezone(tz).date().weekday() + 1) % 7
	hours = _hours_for_weekday(db, data.staff_id, pg_dow)
	if not hours:
		raise AppError("That staff member is not available on this day.")

	busy = _busy_intervals(db, data.staff_id, starts_at - timedelta(days=1), block_end + timedelta(days=1))
	if _overlaps(starts_at, block_end, busy):
		raise ConflictError("That time is no longer available — please pick another slot.")

	row = {
		"workspace_id": workspace_id,
		"location_id": data.location_id,
		"conversation_id": data.conversation_id,
		"staff_id": data.staff_id,
		"service_id": service.id,
		"customer_phone": data.customer_phone,
		"customer_name": data.customer_name,
		"customer_email": data.customer_email,
		"starts_at": starts_at.isoformat(),
		"ends_at": ends_at.isoformat(),
		"status": "confirmed",
		"notes": data.notes,
	}
	res = db.table("dental_appointments").insert(row).execute()
	if not res.data:
		raise AppError("Could not save the appointment.")
	return DentalAppointment(**res.data[0])


def get_appointment(workspace_id: str, appointment_id: str) -> DentalAppointment:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	res = (
		db.table("dental_appointments")
		.select("*")
		.eq("workspace_id", workspace_id)
		.eq("id", appointment_id)
		.limit(1)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Appointment not found")
	return DentalAppointment(**res.data[0])


def list_appointments(
	workspace_id: str,
	date_start: str | None = None,
	date_end: str | None = None,
	limit: int = 100,
) -> list[DentalAppointment]:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	q = (
		db.table("dental_appointments")
		.select("*")
		.eq("workspace_id", workspace_id)
		.order("starts_at", desc=False)
		.limit(limit)
	)
	if date_start:
		q = q.gte("starts_at", f"{date_start}T00:00:00Z")
	if date_end:
		q = q.lt("starts_at", f"{date_end}T23:59:59Z")
	res = q.execute()
	return [DentalAppointment(**row) for row in res.data or []]


def reschedule_appointment(
	workspace_id: str,
	appointment_id: str,
	new_starts_at: datetime,
) -> DentalAppointment:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	appt = get_appointment(workspace_id, appointment_id)
	if not appt.service_id:
		raise AppError("This appointment can't be rescheduled.")
	service = _get_service(workspace_id, appt.service_id)

	starts_at = new_starts_at if new_starts_at.tzinfo else new_starts_at.replace(tzinfo=UTC)
	starts_at = starts_at.astimezone(UTC)
	ends_at = starts_at + timedelta(minutes=service.duration_minutes)
	block_end = starts_at + timedelta(minutes=service.duration_minutes + service.buffer_after_minutes)

	tz = _location_tz(workspace_id, appt.location_id)
	if starts_at.astimezone(tz).date() > _one_month_ahead(datetime.now(tz).date()):
		raise AppError("Appointments can only be booked up to a month in advance.")

	busy = _busy_intervals(
		db,
		appt.staff_id,
		starts_at - timedelta(days=1),
		block_end + timedelta(days=1),
		exclude_appointment_id=appointment_id,
	)
	if _overlaps(starts_at, block_end, busy):
		raise ConflictError("That time isn't available — please pick another slot.")

	res = (
		db.table("dental_appointments")
		.update(
			{
				"starts_at": starts_at.isoformat(),
				"ends_at": ends_at.isoformat(),
				"status": "confirmed",
			}
		)
		.eq("workspace_id", workspace_id)
		.eq("id", appointment_id)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Appointment not found")
	return DentalAppointment(**res.data[0])


def update_appointment_status(
	workspace_id: str,
	appointment_id: str,
	new_status: str,
) -> DentalAppointment:
	_check_dental_vertical(workspace_id)
	db = get_supabase_admin()
	if new_status not in ["pending", "confirmed", "completed", "cancelled", "no_show"]:
		raise AppError("Invalid appointment status.")

	res = (
		db.table("dental_appointments")
		.update({"status": new_status})
		.eq("workspace_id", workspace_id)
		.eq("id", appointment_id)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Appointment not found")
	return DentalAppointment(**res.data[0])
