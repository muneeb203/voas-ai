from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

NotificationType = Literal[
    # business users
    "order_placed",
    "product_update",
    "usage_limit",
    "ticket_reply",
    "ticket_resolved",
    "kiosk_low",
    "appointment_booked",
    # admin team
    "admin_signup",
    "admin_error",
    "admin_ticket",
    "admin_limit",
]


class Notification(BaseModel):
    id: str
    user_id: str
    workspace_id: str | None
    type: NotificationType
    title: str
    body: str | None = None
    link: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    read_at: datetime | None = None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[Notification]
    unread_count: int


class Announcement(BaseModel):
    id: str
    title: str
    body: str
    link: str | None = None
    created_by_admin_id: str | None = None
    published_at: datetime
    created_at: datetime


class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=4000)
    link: str | None = Field(default=None, max_length=500)
