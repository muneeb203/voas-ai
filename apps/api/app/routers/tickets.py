from fastapi import APIRouter, Query, status

from app.deps import WorkspaceContextDep
from app.models.ticket import (
    SignedUploadRequest,
    SignedUploadResponse,
    Ticket,
    TicketCreate,
    TicketMessage,
    TicketMessageCreate,
    TicketStatus,
    TicketStatusUpdate,
    TicketWithMessages,
)
from app.services import storage_service, ticket_service
from app.utils.responses import DataResponse, ok

router = APIRouter(tags=["tickets"])


@router.get(
    "/workspaces/{workspace_id}/tickets",
    response_model=DataResponse[list[Ticket]],
)
async def list_tickets(
    ctx: WorkspaceContextDep,
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
) -> DataResponse[list[Ticket]]:
    tickets = ticket_service.list_tickets(ctx.workspace_id, status_filter)
    return ok(tickets)


@router.post(
    "/workspaces/{workspace_id}/tickets",
    response_model=DataResponse[Ticket],
    status_code=status.HTTP_201_CREATED,
)
async def create_ticket(
    payload: TicketCreate, ctx: WorkspaceContextDep
) -> DataResponse[Ticket]:
    ticket = ticket_service.create_ticket(ctx.workspace_id, ctx.user.id, payload)
    return ok(ticket)


@router.get(
    "/workspaces/{workspace_id}/tickets/{ticket_id}",
    response_model=DataResponse[TicketWithMessages],
)
async def get_ticket(
    ticket_id: str, ctx: WorkspaceContextDep
) -> DataResponse[TicketWithMessages]:
    ticket = ticket_service.get_ticket(ctx.workspace_id, ticket_id)
    return ok(ticket)


@router.post(
    "/workspaces/{workspace_id}/tickets/{ticket_id}/messages",
    response_model=DataResponse[TicketMessage],
    status_code=status.HTTP_201_CREATED,
)
async def add_message(
    ticket_id: str, payload: TicketMessageCreate, ctx: WorkspaceContextDep
) -> DataResponse[TicketMessage]:
    message = ticket_service.add_user_message(
        ctx.workspace_id, ticket_id, ctx.user.id, payload
    )
    return ok(message)


@router.patch(
    "/workspaces/{workspace_id}/tickets/{ticket_id}",
    response_model=DataResponse[Ticket],
)
async def update_ticket_status(
    ticket_id: str, payload: TicketStatusUpdate, ctx: WorkspaceContextDep
) -> DataResponse[Ticket]:
    ticket = ticket_service.update_status(
        ctx.workspace_id, ticket_id, ctx.user.id, payload.status
    )
    return ok(ticket)


@router.post(
    "/workspaces/{workspace_id}/tickets/{ticket_id}/attachments/upload-url",
    response_model=DataResponse[SignedUploadResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_attachment_upload_url(
    ticket_id: str, payload: SignedUploadRequest, ctx: WorkspaceContextDep
) -> DataResponse[SignedUploadResponse]:
    """Returns a one-time signed URL the frontend uses to PUT the file
    directly to Supabase Storage. After the upload succeeds the frontend
    attaches the returned `path` to the ticket/message payload."""
    upload = storage_service.create_signed_upload(
        workspace_id=ctx.workspace_id,
        ticket_id=ticket_id,
        filename=payload.filename,
        content_type=payload.content_type,
        size=payload.size,
    )
    return ok(SignedUploadResponse(**upload))
