from fastapi import APIRouter, BackgroundTasks, status

from app.deps import CurrentUserDep, OwnerContextDep, WorkspaceContextDep
from app.models.workspace import (
    CurrentUserProfile,
    Workspace,
    WorkspaceCreate,
    WorkspaceUpdate,
)
from app.services import voice_service, workspace_service, consultation_hours_service, law_availability_service, law_appointment_service
from app.models.consultation_hours import (
    ConsultationHours,
    ConsultationHoursResponse,
    ConsultationHoursUpdate,
)
from app.models.law_appointment import LawAppointmentCreate, LawAppointment
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["workspaces"])


@router.get("/me", response_model=DataResponse[CurrentUserProfile])
async def get_me(user: CurrentUserDep) -> DataResponse[CurrentUserProfile]:
    profile = workspace_service.get_current_user_profile(user.id, user.email)
    return ok(profile)


@router.post(
    "/workspaces",
    response_model=DataResponse[Workspace],
    status_code=status.HTTP_201_CREATED,
)
async def bootstrap_workspace(
    payload: WorkspaceCreate, user: CurrentUserDep
) -> DataResponse[Workspace]:
    workspace = workspace_service.create_workspace(payload, user.id, user.email)
    return ok(workspace)


@router.get("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def get_workspace(ctx: WorkspaceContextDep) -> DataResponse[Workspace]:
    workspace = workspace_service.get_workspace(ctx.workspace_id)
    return ok(workspace)


@router.patch("/workspaces/{workspace_id}", response_model=DataResponse[Workspace])
async def update_workspace(
    payload: WorkspaceUpdate,
    ctx: OwnerContextDep,
    background_tasks: BackgroundTasks,
) -> DataResponse[Workspace]:
    before = workspace_service.get_workspace(ctx.workspace_id)
    workspace = workspace_service.update_workspace(ctx.workspace_id, payload, ctx.user.id)

    # Vertical change → realign the voice agent (prompt/greeting defaults + the
    # ordering-vs-booking toolset) and re-sync it to Vapi in the background.
    if payload.vertical and payload.vertical != before.vertical:
        voice_service.apply_vertical_to_voice(ctx.workspace_id, payload.vertical)
        background_tasks.add_task(voice_service.sync_assistant_now, ctx.workspace_id)

    return ok(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(ctx: OwnerContextDep) -> None:
    workspace_service.soft_delete_workspace(ctx.workspace_id, ctx.user.id)


@router.get(
    "/workspaces/{workspace_id}/consultation-hours",
    response_model=DataResponse[ConsultationHoursResponse],
)
async def get_consultation_hours(ctx: WorkspaceContextDep) -> DataResponse[ConsultationHoursResponse]:
    hours = consultation_hours_service.get_consultation_hours(ctx.workspace_id)
    return ok(hours)


@router.patch(
    "/workspaces/{workspace_id}/consultation-hours",
    response_model=DataResponse[ConsultationHoursResponse],
)
async def update_consultation_hours(
    payload: ConsultationHoursUpdate,
    ctx: OwnerContextDep,
) -> DataResponse[ConsultationHoursResponse]:
    hours = consultation_hours_service.upsert_consultation_hours(
        ctx.workspace_id, payload.hours
    )
    return ok(hours)


@router.get("/workspaces/{workspace_id}/law/availability")
async def get_law_availability(
    ctx: WorkspaceContextDep,
    date: str,
) -> DataResponse[dict]:
    slots = law_availability_service.get_availability_slots(ctx.workspace_id, date)
    return ok({"date": date, "slots": slots})


@router.post(
    "/workspaces/{workspace_id}/law/appointments",
    response_model=DataResponse[LawAppointment],
    status_code=status.HTTP_201_CREATED,
)
async def book_law_appointment(
    payload: LawAppointmentCreate,
    ctx: WorkspaceContextDep,
) -> DataResponse[LawAppointment]:
    appointment = law_appointment_service.book_appointment(ctx.workspace_id, payload)
    return ok(appointment)
