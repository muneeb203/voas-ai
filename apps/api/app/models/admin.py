from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.location import Location
from app.models.member import Member
from app.models.workspace import Workspace, WorkspaceStatus


class AdminWorkspaceListItem(BaseModel):
    id: str
    name: str
    slug: str
    plan: str
    vertical: str
    status: WorkspaceStatus
    member_count: int
    location_count: int
    open_ticket_count: int
    created_at: datetime
    updated_at: datetime


class AdminWorkspaceDetail(BaseModel):
    workspace: Workspace
    members: list[Member]
    locations: list[Location]


class AdminUserSummary(BaseModel):
    id: str
    email: str | None
    full_name: str | None
    last_sign_in_at: datetime | None
    created_at: datetime
    is_admin: bool
    workspaces: list[dict]


class AdminAuditEntry(BaseModel):
    id: str
    actor_type: Literal["user", "admin", "system"]
    actor_id: str
    actor_name: str | None
    actor_email: str | None
    workspace_id: str | None
    workspace_name: str | None
    action: str
    resource_type: str | None
    resource_id: str | None
    metadata: dict | None
    created_at: datetime


class AdminContactSubmission(BaseModel):
    id: str
    name: str
    email: str
    company: str | None
    phone: str | None
    message: str
    source: str | None
    status: Literal["new", "contacted", "qualified", "closed"]
    created_at: datetime


class AdminContactUpdate(BaseModel):
    status: Literal["new", "contacted", "qualified", "closed"] | None = None
    notes: str | None = None
