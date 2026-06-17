from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.deps import AdminContextDep
from app.models.admin import (
    AdminAuditEntry,
    AdminContactSubmission,
    AdminContactUpdate,
    AdminUserSummary,
    AdminWorkspaceDetail,
    AdminWorkspaceListItem,
)
from app.models.billing import (
    AdminBillingUpdate,
    AdminWorkspaceUsageRow,
    CreditGrant,
    CreditGrantCreate,
    UsageSummary,
)
from app.models.notification import Announcement, AnnouncementCreate
from app.models.ticket import (
    Ticket,
    TicketMessage,
    TicketStatus,
    TicketWithMessages,
)
from app.models.workspace import Workspace
from app.services import (
    admin_audit_service,
    admin_contact_service,
    admin_ticket_service,
    admin_user_service,
    admin_workspace_service,
    announcement_service,
    billing_service,
    impersonation_service,
)
from app.utils.responses import DataResponse, ok

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------- Workspaces ------------------------------------------------------


@router.get("/workspaces", response_model=DataResponse[list[AdminWorkspaceListItem]])
async def list_workspaces(
    _: AdminContextDep,
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    plan: str | None = Query(default=None),
) -> DataResponse[list[AdminWorkspaceListItem]]:
    workspaces = admin_workspace_service.list_workspaces(
        search=search,
        status=status_filter,  # type: ignore[arg-type]
        plan=plan,
    )
    return ok(workspaces)


@router.get("/workspaces/{workspace_id}", response_model=DataResponse[AdminWorkspaceDetail])
async def get_workspace(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[AdminWorkspaceDetail]:
    detail = admin_workspace_service.get_detail(workspace_id)
    return ok(detail)


@router.post("/workspaces/{workspace_id}/suspend", response_model=DataResponse[Workspace])
async def suspend_workspace(workspace_id: str, ctx: AdminContextDep) -> DataResponse[Workspace]:
    workspace = admin_workspace_service.suspend(workspace_id, ctx.admin_id)
    return ok(workspace)


@router.post("/workspaces/{workspace_id}/restore", response_model=DataResponse[Workspace])
async def restore_workspace(workspace_id: str, ctx: AdminContextDep) -> DataResponse[Workspace]:
    workspace = admin_workspace_service.restore(workspace_id, ctx.admin_id)
    return ok(workspace)


@router.delete("/workspaces/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: str, ctx: AdminContextDep) -> None:
    admin_workspace_service.soft_delete(workspace_id, ctx.admin_id)


# ---------- Impersonation ---------------------------------------------------


class ImpersonationPayload(BaseModel):
    workspace_id: str
    workspace_name: str
    started_at: str


@router.post(
    "/workspaces/{workspace_id}/impersonate",
    response_model=DataResponse[ImpersonationPayload],
)
async def start_impersonation(
    workspace_id: str, ctx: AdminContextDep
) -> DataResponse[ImpersonationPayload]:
    data = impersonation_service.start(workspace_id, ctx.admin_id)
    return ok(ImpersonationPayload(**data))


class ExitImpersonationBody(BaseModel):
    workspace_id: str | None = None


@router.post("/impersonate/exit", status_code=status.HTTP_204_NO_CONTENT)
async def end_impersonation(body: ExitImpersonationBody, ctx: AdminContextDep) -> None:
    impersonation_service.end(body.workspace_id, ctx.admin_id)


# ---------- Users -----------------------------------------------------------


@router.get("/users", response_model=DataResponse[list[AdminUserSummary]])
async def list_users(_: AdminContextDep) -> DataResponse[list[AdminUserSummary]]:
    return ok(admin_user_service.list_users())


# ---------- Tickets (admin inbox) ------------------------------------------


@router.get("/tickets", response_model=DataResponse[list[Ticket]])
async def list_tickets(
    _: AdminContextDep,
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
    priority: str | None = Query(default=None),
    workspace_id: str | None = Query(default=None),
    assigned_admin_id: str | None = Query(default=None, alias="assigned"),
) -> DataResponse[list[Ticket]]:
    tickets = admin_ticket_service.list_all_tickets(
        status=status_filter,
        priority=priority,
        workspace_id=workspace_id,
        assigned_admin_id=assigned_admin_id,
    )
    return ok(tickets)


@router.get("/tickets/{ticket_id}", response_model=DataResponse[TicketWithMessages])
async def get_ticket(ticket_id: str, _: AdminContextDep) -> DataResponse[TicketWithMessages]:
    return ok(admin_ticket_service.get_ticket(ticket_id))


class AdminReplyPayload(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    is_internal_note: bool = False


@router.post(
    "/tickets/{ticket_id}/messages",
    response_model=DataResponse[TicketMessage],
    status_code=status.HTTP_201_CREATED,
)
async def admin_reply(
    ticket_id: str, payload: AdminReplyPayload, ctx: AdminContextDep
) -> DataResponse[TicketMessage]:
    message = admin_ticket_service.reply(
        ticket_id, ctx.admin_id, payload.body, is_internal_note=payload.is_internal_note
    )
    return ok(message)


class AdminTicketUpdate(BaseModel):
    status: TicketStatus | None = None
    assigned_admin_id: str | None = Field(default=None)


@router.patch("/tickets/{ticket_id}", response_model=DataResponse[Ticket])
async def admin_update_ticket(
    ticket_id: str, payload: AdminTicketUpdate, ctx: AdminContextDep
) -> DataResponse[Ticket]:
    ticket: Ticket | None = None
    if payload.status is not None:
        ticket = admin_ticket_service.update_status(ticket_id, ctx.admin_id, payload.status)
    if "assigned_admin_id" in payload.model_fields_set:
        ticket = admin_ticket_service.assign(ticket_id, ctx.admin_id, payload.assigned_admin_id)
    if ticket is None:
        ticket = admin_ticket_service.get_ticket(ticket_id)  # no-op echo
    return ok(ticket)  # type: ignore[arg-type]


# ---------- Contact submissions ---------------------------------------------


@router.get("/contact-submissions", response_model=DataResponse[list[AdminContactSubmission]])
async def list_contact_submissions(
    _: AdminContextDep, status_filter: str | None = Query(default=None, alias="status")
) -> DataResponse[list[AdminContactSubmission]]:
    return ok(admin_contact_service.list_submissions(status=status_filter))


@router.patch(
    "/contact-submissions/{submission_id}",
    response_model=DataResponse[AdminContactSubmission],
)
async def update_contact_submission(
    submission_id: str, payload: AdminContactUpdate, ctx: AdminContextDep
) -> DataResponse[AdminContactSubmission]:
    return ok(admin_contact_service.update_submission(submission_id, payload, ctx.admin_id))


# ---------- Audit log -------------------------------------------------------


@router.get("/audit-logs", response_model=DataResponse[list[AdminAuditEntry]])
async def list_audit_logs(
    _: AdminContextDep,
    actor_type: str | None = Query(default=None),
    action: str | None = Query(default=None),
    workspace_id: str | None = Query(default=None),
) -> DataResponse[list[AdminAuditEntry]]:
    return ok(
        admin_audit_service.list_entries(
            actor_type=actor_type, action=action, workspace_id=workspace_id
        )
    )


# ---------- Announcements ---------------------------------------------------


@router.get("/announcements", response_model=DataResponse[list[Announcement]])
async def list_announcements(_: AdminContextDep) -> DataResponse[list[Announcement]]:
    return ok(announcement_service.list_announcements())


@router.post(
    "/announcements",
    response_model=DataResponse[Announcement],
    status_code=status.HTTP_201_CREATED,
)
async def publish_announcement(
    payload: AnnouncementCreate,
    ctx: AdminContextDep,
) -> DataResponse[Announcement]:
    return ok(
        announcement_service.publish(
            payload,
            admin_id=ctx.admin_id,
            admin_user_id=ctx.user.id,
        )
    )


# ---------- Billing / usage -------------------------------------------------


@router.get("/usage", response_model=DataResponse[list[AdminWorkspaceUsageRow]])
async def list_usage(_: AdminContextDep) -> DataResponse[list[AdminWorkspaceUsageRow]]:
    return ok(billing_service.list_admin_usage())


@router.get(
    "/workspaces/{workspace_id}/billing/usage",
    response_model=DataResponse[UsageSummary],
)
async def get_workspace_usage(workspace_id: str, _: AdminContextDep) -> DataResponse[UsageSummary]:
    return ok(billing_service.get_usage_summary(workspace_id))


@router.get(
    "/workspaces/{workspace_id}/billing/grants",
    response_model=DataResponse[list[CreditGrant]],
)
async def list_workspace_grants(
    workspace_id: str, _: AdminContextDep
) -> DataResponse[list[CreditGrant]]:
    return ok(billing_service.list_grants(workspace_id))


@router.post(
    "/workspaces/{workspace_id}/billing/grants",
    response_model=DataResponse[CreditGrant],
    status_code=status.HTTP_201_CREATED,
)
async def grant_workspace_credits(
    workspace_id: str,
    payload: CreditGrantCreate,
    ctx: AdminContextDep,
) -> DataResponse[CreditGrant]:
    return ok(billing_service.grant_credits(workspace_id, payload, ctx.admin_id))


@router.patch(
    "/workspaces/{workspace_id}/billing",
    response_model=DataResponse[UsageSummary],
)
async def update_workspace_billing(
    workspace_id: str,
    payload: AdminBillingUpdate,
    ctx: AdminContextDep,
) -> DataResponse[UsageSummary]:
    return ok(billing_service.update_workspace_billing(workspace_id, payload, ctx.admin_id))
