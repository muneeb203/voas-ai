from fastapi import APIRouter, Query, status

from app.core.exceptions import AppError, NotFoundError
from app.core.supabase import get_supabase_admin
from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.dental import (
	AppointmentStatusUpdate,
	AvailabilityResult,
	BookAppointmentInput,
	DentalAppointment,
	DentalService,
	DentalServiceCreate,
	DentalServiceUpdate,
	DentalStaff,
	DentalStaffCreate,
	DentalStaffUpdate,
	RescheduleInput,
)
from app.services import dental_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["dental"])


# --- Services ---------------------------------------------------------------


@router.get(
	"/workspaces/{workspace_id}/dental/services",
	response_model=DataResponse[list[DentalService]],
)
async def list_services(
	ctx: WorkspaceContextDep,
	active_only: bool = Query(default=False),
) -> DataResponse[list[DentalService]]:
	return ok(dental_service.list_services(ctx.workspace_id, active_only=active_only))


@router.post(
	"/workspaces/{workspace_id}/dental/services",
	response_model=DataResponse[DentalService],
	status_code=status.HTTP_201_CREATED,
)
async def create_service(
	payload: DentalServiceCreate, ctx: OwnerContextDep
) -> DataResponse[DentalService]:
	db = get_supabase_admin()
	row = {
		"workspace_id": ctx.workspace_id,
		"name": payload.name,
		"description": payload.description,
		"duration_minutes": payload.duration_minutes,
		"buffer_after_minutes": payload.buffer_after_minutes,
		"price_cents": payload.price_cents,
	}
	res = db.table("dental_services").insert(row).execute()
	if not res.data:
		raise AppError("Could not create service.")
	return ok(DentalService(**res.data[0]))


@router.patch(
	"/workspaces/{workspace_id}/dental/services/{service_id}",
	response_model=DataResponse[DentalService],
)
async def update_service(
	service_id: str, payload: DentalServiceUpdate, ctx: OwnerContextDep
) -> DataResponse[DentalService]:
	db = get_supabase_admin()
	update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
	res = (
		db.table("dental_services")
		.update(update_data)
		.eq("workspace_id", ctx.workspace_id)
		.eq("id", service_id)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Service not found")
	return ok(DentalService(**res.data[0]))


@router.delete(
	"/workspaces/{workspace_id}/dental/services/{service_id}",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_service(service_id: str, ctx: OwnerContextDep) -> None:
	db = get_supabase_admin()
	db.table("dental_services").delete().eq("workspace_id", ctx.workspace_id).eq(
		"id", service_id
	).execute()


# --- Staff ------------------------------------------------------------------


@router.get(
	"/workspaces/{workspace_id}/dental/staff",
	response_model=DataResponse[list[DentalStaff]],
)
async def list_staff(
	ctx: WorkspaceContextDep,
	active_only: bool = Query(default=False),
) -> DataResponse[list[DentalStaff]]:
	return ok(dental_service.list_staff(ctx.workspace_id, active_only=active_only))


@router.post(
	"/workspaces/{workspace_id}/dental/staff",
	response_model=DataResponse[DentalStaff],
	status_code=status.HTTP_201_CREATED,
)
async def create_staff(
	payload: DentalStaffCreate, ctx: OwnerContextDep
) -> DataResponse[DentalStaff]:
	db = get_supabase_admin()
	row = {
		"workspace_id": ctx.workspace_id,
		"name": payload.name,
		"title": payload.title,
		"email": payload.email,
		"phone": payload.phone,
	}
	res = db.table("dental_staff").insert(row).execute()
	if not res.data:
		raise AppError("Could not create staff member.")
	return ok(DentalStaff(**res.data[0]))


@router.patch(
	"/workspaces/{workspace_id}/dental/staff/{staff_id}",
	response_model=DataResponse[DentalStaff],
)
async def update_staff(
	staff_id: str, payload: DentalStaffUpdate, ctx: OwnerContextDep
) -> DataResponse[DentalStaff]:
	db = get_supabase_admin()
	update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
	res = (
		db.table("dental_staff")
		.update(update_data)
		.eq("workspace_id", ctx.workspace_id)
		.eq("id", staff_id)
		.execute()
	)
	if not res.data:
		raise NotFoundError("Staff member not found")
	return ok(DentalStaff(**res.data[0]))


@router.delete(
	"/workspaces/{workspace_id}/dental/staff/{staff_id}",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_staff(staff_id: str, ctx: OwnerContextDep) -> None:
	db = get_supabase_admin()
	db.table("dental_staff").delete().eq("workspace_id", ctx.workspace_id).eq(
		"id", staff_id
	).execute()


# --- Appointments -----------------------------------------------------------


@router.get(
	"/workspaces/{workspace_id}/dental/availability",
	response_model=DataResponse[AvailabilityResult],
)
async def get_availability(
	ctx: WorkspaceContextDep,
	service_id: str = Query(...),
	date: str = Query(...),
	staff_id: str | None = Query(None),
	location_id: str | None = Query(None),
) -> DataResponse[AvailabilityResult]:
	result = dental_service.get_availability(
		ctx.workspace_id,
		service_id=service_id,
		date_str=date,
		staff_id=staff_id,
		location_id=location_id,
	)
	return ok(result)


@router.post(
	"/workspaces/{workspace_id}/dental/appointments",
	response_model=DataResponse[DentalAppointment],
	status_code=status.HTTP_201_CREATED,
)
async def create_appointment(
	payload: BookAppointmentInput,
	ctx: WorkspaceContextDep,
) -> DataResponse[DentalAppointment]:
	appointment = dental_service.create_appointment(ctx.workspace_id, payload)
	return ok(appointment)


@router.get(
	"/workspaces/{workspace_id}/dental/appointments",
	response_model=DataResponse[list[DentalAppointment]],
)
async def list_appointments(
	ctx: WorkspaceContextDep,
	date_start: str | None = Query(None),
	date_end: str | None = Query(None),
	limit: int = Query(default=100, ge=1, le=500),
) -> DataResponse[list[DentalAppointment]]:
	appointments = dental_service.list_appointments(
		ctx.workspace_id,
		date_start=date_start,
		date_end=date_end,
		limit=limit,
	)
	return ok(appointments)


@router.get(
	"/workspaces/{workspace_id}/dental/appointments/{appointment_id}",
	response_model=DataResponse[DentalAppointment],
)
async def get_appointment(
	appointment_id: str,
	ctx: WorkspaceContextDep,
) -> DataResponse[DentalAppointment]:
	appointment = dental_service.get_appointment(ctx.workspace_id, appointment_id)
	return ok(appointment)


@router.put(
	"/workspaces/{workspace_id}/dental/appointments/{appointment_id}/reschedule",
	response_model=DataResponse[DentalAppointment],
)
async def reschedule_appointment(
	appointment_id: str,
	payload: RescheduleInput,
	ctx: WorkspaceContextDep,
) -> DataResponse[DentalAppointment]:
	appointment = dental_service.reschedule_appointment(
		ctx.workspace_id,
		appointment_id,
		payload.new_starts_at,
	)
	return ok(appointment)


@router.put(
	"/workspaces/{workspace_id}/dental/appointments/{appointment_id}/status",
	response_model=DataResponse[DentalAppointment],
)
async def update_appointment_status(
	appointment_id: str,
	payload: AppointmentStatusUpdate,
	ctx: WorkspaceContextDep,
) -> DataResponse[DentalAppointment]:
	appointment = dental_service.update_appointment_status(
		ctx.workspace_id,
		appointment_id,
		payload.status,
	)
	return ok(appointment)


# --- Staff Hours -----------------------------------------------------------


@router.put(
	"/workspaces/{workspace_id}/dental/staff/{staff_id}/hours",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def update_staff_hours(
	staff_id: str,
	payload: dict,  # {weekday: int, start_time: str, end_time: str, break_start?: str, break_end?: str}
	ctx: OwnerContextDep,
) -> None:
	db = get_supabase_admin()
	# Delete existing entry for this day
	db.table("dental_staff_hours").delete().eq("staff_id", staff_id).eq(
		"weekday", payload["weekday"]
	).execute()
	# Insert new hours
	row = {
		"staff_id": staff_id,
		"weekday": payload["weekday"],
		"start_time": payload["start_time"],
		"end_time": payload["end_time"],
		"break_start": payload.get("break_start"),
		"break_end": payload.get("break_end"),
	}
	db.table("dental_staff_hours").insert(row).execute()
