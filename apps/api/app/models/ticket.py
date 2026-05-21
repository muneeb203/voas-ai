from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

TicketStatus = Literal["open", "in_progress", "waiting_user", "resolved", "closed"]
TicketPriority = Literal["low", "normal", "high", "urgent"]
TicketCategory = Literal["billing", "integration", "bug", "feature_request", "other"]
MessageSenderType = Literal["user", "admin", "system"]

# Statuses a regular workspace user can set on their own ticket.
# Admins (Sprint 5) get the full set including in_progress, waiting_user, closed.
USER_SETTABLE_STATUSES: tuple[TicketStatus, ...] = ("resolved",)


class TicketMessage(BaseModel):
    id: str
    ticket_id: str
    sender_type: MessageSenderType
    sender_id: str
    sender_name: str | None
    sender_email: str | None
    body: str
    attachments: list[dict] | None
    is_internal_note: bool
    created_at: datetime


class Ticket(BaseModel):
    id: str
    workspace_id: str
    created_by: str
    creator_name: str | None
    creator_email: str | None
    assigned_admin_id: str | None
    subject: str
    status: TicketStatus
    priority: TicketPriority
    category: TicketCategory | None
    message_count: int
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None


class TicketWithMessages(Ticket):
    messages: list[TicketMessage]


class AttachmentRef(BaseModel):
    path: str = Field(..., min_length=10, max_length=400)
    filename: str = Field(..., min_length=1, max_length=200)
    content_type: str = Field(..., min_length=1, max_length=120)
    size: int = Field(..., ge=0, le=10 * 1024 * 1024)


class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    body: str = Field(..., min_length=3, max_length=5000)
    category: TicketCategory = "other"
    priority: TicketPriority = "normal"
    # Attachments are added on replies (after the ticket exists). Path scheme
    # is `<workspace_id>/<ticket_id>/<uuid>-<filename>`.


class TicketMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=5000)
    attachments: list[AttachmentRef] | None = None


class TicketStatusUpdate(BaseModel):
    status: TicketStatus


class SignedUploadRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=200)
    content_type: str = Field(..., min_length=1, max_length=120)
    size: int = Field(..., ge=1, le=10 * 1024 * 1024)


class SignedUploadResponse(BaseModel):
    path: str
    signed_url: str
    token: str | None = None
    bucket: str
    filename: str
    content_type: str
    size: int
