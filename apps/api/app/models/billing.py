from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

UsageEventType = Literal[
    "voice_minutes",
    "whatsapp_in",
    "whatsapp_out",
    "help_bot_turns",
]
CreditType = Literal["voice_minutes", "whatsapp_messages", "help_bot_turns"]
BillingPlanSlug = Literal["essentials", "professional", "business", "enterprise"]


class BillingPlan(BaseModel):
    slug: BillingPlanSlug
    name: str
    price_cents_monthly: int
    voice_minutes_limit: int | None
    whatsapp_messages_limit: int | None
    help_bot_turns_limit: int | None
    allowed_channels: list[str]


class UsageMetric(BaseModel):
    used: int
    plan_limit: int | None
    bonus_remaining: int
    effective_limit: int | None
    percent_used: float | None


class TokenUsage(BaseModel):
    openai_tokens: int
    gemini_tokens: int
    total_tokens: int


class BillingPeriod(BaseModel):
    start: datetime
    end: datetime
    days_remaining: int


class UsageSummary(BaseModel):
    plan: BillingPlan
    period: BillingPeriod
    voice_minutes: UsageMetric
    whatsapp_messages: UsageMetric
    help_bot_turns: UsageMetric
    tokens: TokenUsage
    usage_enforcement_disabled: bool
    enforcement_active: bool
    # True when the workspace was auto-granted a free trial on signup.
    # Remains True even after the trial minutes run out so the UI can
    # show the right CTA ("contact us to continue" vs "reload credits").
    has_trial_grant: bool = False


class CreditGrant(BaseModel):
    id: str
    workspace_id: str
    credit_type: CreditType
    amount_total: int
    amount_remaining: int
    reason: str | None
    granted_by_admin_id: str | None
    created_at: datetime


class CreditGrantCreate(BaseModel):
    credit_type: CreditType
    amount: int = Field(..., ge=1, le=1_000_000)
    reason: str | None = Field(default=None, max_length=500)


class AdminWorkspaceUsageRow(BaseModel):
    workspace_id: str
    workspace_name: str
    plan: BillingPlanSlug
    status: str
    voice_used: int
    voice_limit: int | None
    whatsapp_used: int
    whatsapp_limit: int | None
    help_used: int
    help_limit: int | None
    total_tokens: int
    usage_enforcement_disabled: bool
    period_end: datetime


class AdminBillingUpdate(BaseModel):
    plan: BillingPlanSlug | None = None
    usage_enforcement_disabled: bool | None = None
