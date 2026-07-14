from fastapi import APIRouter, Query, status

from app.deps import OwnerContextDep, WorkspaceContextDep
from app.models.salon import (
    AppointmentStatusUpdate,
    AvailabilityResult,
    BookAppointmentInput,
    SalonAppointment,
    SalonService,
    SalonServiceCreate,
    SalonServiceUpdate,
    SalonStaff,
    SalonStaffCreate,
    SalonStaffUpdate,
)
from app.services import booking_service, salon_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["salon"])


# --- Services ---------------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/salon/services",
    response_model=DataResponse[list[SalonService]],
)
async def list_services(
    ctx: WorkspaceContextDep,
    active_only: bool = Query(default=False),
) -> DataResponse[list[SalonService]]:
    return ok(salon_service.list_services(ctx.workspace_id, active_only=active_only))


@router.post(
    "/workspaces/{workspace_id}/salon/services",
    response_model=DataResponse[SalonService],
    status_code=status.HTTP_201_CREATED,
)
async def create_service(
    payload: SalonServiceCreate, ctx: OwnerContextDep
) -> DataResponse[SalonService]:
    return ok(salon_service.create_service(ctx.workspace_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/salon/services/{service_id}",
    response_model=DataResponse[SalonService],
)
async def update_service(
    service_id: str, payload: SalonServiceUpdate, ctx: OwnerContextDep
) -> DataResponse[SalonService]:
    return ok(salon_service.update_service(ctx.workspace_id, service_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/salon/services/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_service(service_id: str, ctx: OwnerContextDep) -> None:
    salon_service.delete_service(ctx.workspace_id, service_id, ctx.user.id)


# --- Staff ------------------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/salon/staff",
    response_model=DataResponse[list[SalonStaff]],
)
async def list_staff(
    ctx: WorkspaceContextDep,
    active_only: bool = Query(default=False),
) -> DataResponse[list[SalonStaff]]:
    return ok(salon_service.list_staff(ctx.workspace_id, active_only=active_only))


@router.post(
    "/workspaces/{workspace_id}/salon/staff",
    response_model=DataResponse[SalonStaff],
    status_code=status.HTTP_201_CREATED,
)
async def create_staff(payload: SalonStaffCreate, ctx: OwnerContextDep) -> DataResponse[SalonStaff]:
    return ok(salon_service.create_staff(ctx.workspace_id, payload, ctx.user.id))


@router.patch(
    "/workspaces/{workspace_id}/salon/staff/{staff_id}",
    response_model=DataResponse[SalonStaff],
)
async def update_staff(
    staff_id: str, payload: SalonStaffUpdate, ctx: OwnerContextDep
) -> DataResponse[SalonStaff]:
    return ok(salon_service.update_staff(ctx.workspace_id, staff_id, payload, ctx.user.id))


@router.delete(
    "/workspaces/{workspace_id}/salon/staff/{staff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_staff(staff_id: str, ctx: OwnerContextDep) -> None:
    salon_service.delete_staff(ctx.workspace_id, staff_id, ctx.user.id)


# --- Availability -----------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/salon/availability",
    response_model=DataResponse[AvailabilityResult],
)
async def get_availability(
    ctx: WorkspaceContextDep,
    service_id: str = Query(...),
    date: str = Query(..., description="YYYY-MM-DD"),
    staff_id: str | None = Query(default=None),
    location_id: str | None = Query(default=None),
) -> DataResponse[AvailabilityResult]:
    return ok(
        booking_service.get_availability(
            ctx.workspace_id,
            service_id=service_id,
            date_str=date,
            staff_id=staff_id,
            location_id=location_id,
        )
    )


# --- Appointments -----------------------------------------------------------


@router.get(
    "/workspaces/{workspace_id}/salon/appointments",
    response_model=DataResponse[list[SalonAppointment]],
)
async def list_appointments(
    ctx: WorkspaceContextDep,
    status_filter: str | None = Query(default=None, alias="status"),
    from_iso: str | None = Query(default=None, alias="from"),
    to_iso: str | None = Query(default=None, alias="to"),
) -> DataResponse[list[SalonAppointment]]:
    return ok(
        salon_service.list_appointments(
            ctx.workspace_id, status=status_filter, from_iso=from_iso, to_iso=to_iso
        )
    )


@router.post(
    "/workspaces/{workspace_id}/salon/appointments",
    response_model=DataResponse[SalonAppointment],
    status_code=status.HTTP_201_CREATED,
)
async def book_appointment(
    payload: BookAppointmentInput, ctx: WorkspaceContextDep
) -> DataResponse[SalonAppointment]:
    return ok(booking_service.create_appointment(ctx.workspace_id, payload))


@router.patch(
    "/workspaces/{workspace_id}/salon/appointments/{appointment_id}/status",
    response_model=DataResponse[SalonAppointment],
)
async def update_appointment_status(
    appointment_id: str, payload: AppointmentStatusUpdate, ctx: WorkspaceContextDep
) -> DataResponse[SalonAppointment]:
    return ok(
        salon_service.update_appointment_status(
            ctx.workspace_id, appointment_id, payload, ctx.user.id
        )
    )
