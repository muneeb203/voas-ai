from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

NotificationType = Literal["order_placed", "product_update"]


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
