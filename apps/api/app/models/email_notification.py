from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class CallData(BaseModel):
    caller_name: str
    caller_phone: str
    duration_seconds: int
    transcript: str
    inquiry: str
    location: str


class EmailNotificationSettings(BaseModel):
    id: str
    workspace_id: str
    enabled: bool
    recipient_email: str
    rate_limit_per_hour: int
    created_at: datetime
    updated_at: datetime


class EmailNotificationSettingsUpdate(BaseModel):
    enabled: bool


class EmailQueueItem(BaseModel):
    id: str
    workspace_id: str
    recipient_email: str
    call_data: CallData
    status: Literal["pending", "sent", "failed"]
    scheduled_time: datetime
    sent_at: datetime | None
    error_message: str | None
    retry_count: int
    created_at: datetime


class EmailLog(BaseModel):
    id: str
    workspace_id: str
    recipient_email: str
    call_data: CallData
    sent_at: datetime
    status: Literal["success", "failed"]
    error_message: str | None


class SendEmailRequest(BaseModel):
    caller_name: str
    caller_phone: str
    duration_seconds: int
    transcript: str
    inquiry: str
    location: str
