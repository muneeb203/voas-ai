from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

WorkspaceVertical = Literal["restaurant", "dental", "salon", "auto", "other"]
WorkspacePlan = Literal["starter", "growth", "scale", "enterprise"]
WorkspaceStatus = Literal["active", "suspended", "deleted"]
MemberRole = Literal["owner", "manager", "staff"]


class Workspace(BaseModel):
    id: str
    name: str
    slug: str
    plan: WorkspacePlan
    vertical: WorkspaceVertical
    status: WorkspaceStatus
    created_at: datetime
    updated_at: datetime


class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    vertical: WorkspaceVertical = "restaurant"
    location_name: str = Field(..., min_length=2, max_length=200)
    location_address: str | None = Field(default=None, max_length=300)
    location_phone: str | None = Field(default=None, max_length=50)


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
