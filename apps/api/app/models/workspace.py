from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

WorkspaceVertical = Literal["restaurant", "dental", "salon", "auto", "other"]
WorkspacePlan = Literal["trial", "essentials", "professional", "business", "enterprise"]
WorkspaceStatus = Literal["active", "suspended", "deleted"]
MemberRole = Literal["owner", "manager", "staff"]


class Workspace(BaseModel):
    id: str
    name: str
    slug: str
    plan: WorkspacePlan
    vertical: WorkspaceVertical
    status: WorkspaceStatus
    usage_enforcement_disabled: bool = False
    created_at: datetime
    updated_at: datetime


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    vertical: WorkspaceVertical = "restaurant"
    location_name: str | None = Field(default=None, max_length=200)
    location_address: str | None = Field(default=None, max_length=300)
    location_city: str | None = Field(default=None, max_length=100)
    location_state: str | None = Field(default=None, max_length=100)
    location_zip: str | None = Field(default=None, max_length=20)
    location_phone: str | None = Field(default=None, max_length=50)
    location_timezone: str | None = Field(default=None, max_length=100)
    location_hours: dict | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    vertical: WorkspaceVertical | None = None


class WorkspaceMembership(BaseModel):
    workspace_id: str
    role: MemberRole
    joined_at: datetime | None
    workspace: Workspace


class CurrentUserProfile(BaseModel):
    id: str
    email: str | None
    full_name: str | None
    memberships: list[WorkspaceMembership]
