from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.customer import Customer

ConversationChannel = Literal["voice", "whatsapp", "chat", "sms"]
ConversationStatus = Literal["active", "ended", "abandoned", "escalated"]
ConversationOutcome = Literal[
    "order_placed", "question_answered", "booking_made", "escalated", "no_resolution"
]
MessageRole = Literal["customer", "agent", "system"]


class ConversationMessage(BaseModel):
    id: str
    conversation_id: str
    role: MessageRole
    content: str
    audio_url: str | None
    created_at: datetime


class ConversationMessageCreate(BaseModel):
    role: MessageRole
    content: str = Field(..., min_length=1, max_length=10000)
    audio_url: str | None = None


class Conversation(BaseModel):
    id: str
    workspace_id: str
    location_id: str | None
    customer_id: str | None
    channel: ConversationChannel
    customer_phone: str | None
    customer_name: str | None
    started_at: datetime
    ended_at: datetime | None
    duration_seconds: int | None
    status: ConversationStatus
    sentiment: float | None
    summary: str | None
    recording_url: str | None
    outcome: ConversationOutcome | None
    metadata: dict | None
    created_at: datetime
    updated_at: datetime
    message_count: int


class ConversationDetail(Conversation):
    messages: list[ConversationMessage]
    customer: Customer | None
    order_id: str | None


class ConversationCreate(BaseModel):
    """Used by V2 Sprint 2+ webhooks and tests."""
    channel: ConversationChannel
    location_id: str | None = None
    customer_phone: str | None = Field(default=None, max_length=50)
    customer_name: str | None = Field(default=None, max_length=200)


class EscalationRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)
