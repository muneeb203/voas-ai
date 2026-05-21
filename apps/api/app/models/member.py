from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

MemberRole = Literal["owner", "manager", "staff"]


class Member(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: MemberRole
    email: str | None
    full_name: str | None
    invited_at: datetime | None
    joined_at: datetime | None
    created_at: datetime


class MemberUpdate(BaseModel):
    role: MemberRole


class Invitation(BaseModel):
    id: str
    workspace_id: str
    email: str
    role: MemberRole
    invited_by: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime


class InvitationWithUrl(Invitation):
    """Returned only at create time so the inviter can copy the link.

    The token is embedded in `url` and not exposed separately to keep the
    surface area for accidental logging small.
    """

    url: str


class InvitationCreate(BaseModel):
    email: EmailStr
    role: MemberRole = "staff"


class InvitationLookup(BaseModel):
    id: str
    workspace_id: str
    workspace_name: str
    email: str
    role: MemberRole
    expires_at: datetime
    accepted_at: datetime | None
