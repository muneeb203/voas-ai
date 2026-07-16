from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.models.location import Location
from app.models.member import Member
from app.models.menu import MenuCategory, MenuItem
from app.models.salon import SalonService, SalonStaff
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
    # Health at a glance, so a broken or dormant business is visible from the
    # list instead of only after opening it.
    last_activity_at: datetime | None = None
    error_count: int = 0
    voice_enabled: bool = False
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


class AdminActivityItem(BaseModel):
    """One thing the business actually did — a call/chat, an order, a booking."""

    kind: Literal["conversation", "order", "appointment"]
    id: str
    at: datetime
    title: str
    subtitle: str | None = None
    status: str | None = None
    channel: str | None = None


class AdminUsageHistoryPoint(BaseModel):
    date: str  # YYYY-MM-DD
    voice_minutes: float
    whatsapp_messages: float
    help_bot_turns: float


class AdminKbVoice(BaseModel):
    """The agent's instructions — arguably the biggest part of what it 'knows'."""

    enabled: bool
    system_prompt: str
    greeting: str
    voice: str
    model: str
    language: str


class AdminKnowledgeBase(BaseModel):
    """Read-only view of everything a business's AI is working from.

    Vertical decides which half is populated: a restaurant's knowledge is its
    menu; a salon's is its services, staff and the hours they work.
    """

    vertical: str
    voice: AdminKbVoice | None = None
    # restaurant
    categories: list[MenuCategory] = []
    items: list[MenuItem] = []
    # salon
    services: list[SalonService] = []
    staff: list[SalonStaff] = []


class AdminErrorLogEntry(BaseModel):
    id: str
    workspace_id: str | None
    kind: Literal["crash", "integration"]
    source: str
    message: str
    context: dict | None
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
