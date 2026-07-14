from datetime import datetime

from pydantic import BaseModel, Field

# Available LLMs for WhatsApp replies. WhatsApp uses our own OpenAI call
# (not Vapi), so the list is OpenAI chat models only.
AVAILABLE_MODELS = [
    {"id": "gpt-4o-mini", "label": "GPT-4o mini (fast, cheap, recommended)"},
    {"id": "gpt-4o", "label": "GPT-4o (smarter, slower)"},
]

DEFAULT_GREETING = "Hi! How can I help you today?"

# Appended to whatever system prompt the workspace sets. Tunes the agent for
# short WhatsApp text turns and defines the order-capture protocol the
# webhook parser relies on (the <<<ORDER>>> … <<<END_ORDER>>> markers).
WHATSAPP_PROMPT_SUFFIX = """

You are responding via WhatsApp text. Keep messages short (1-3 sentences max).
No markdown formatting. Use simple line breaks only.
When a customer confirms their complete order (items + quantities + name + phone),
output their reply AND a JSON block like this (on a new line, not shown to customer):
<<<ORDER>>>
{"items": [{"name": "...", "quantity": 1, "modifiers": [], "notes": null}],
 "customer_name": "...", "customer_phone": "...", "fulfillment": "pickup"}
<<<END_ORDER>>>"""


# --- Salon (appointment booking) variants ---------------------------------

WHATSAPP_SALON_SYSTEM_PROMPT = """You are the friendly booking assistant for a salon, replying to customers on WhatsApp.

Your job:
- Help the customer book an appointment for one of the SERVICES listed below.
- Be warm and concise. This is appointment booking only — no orders, no delivery.
- Offer times ONLY from the AVAILABLE APPOINTMENTS list. Never invent or promise a time that isn't listed. If none suit the customer, tell them what else is open.
- Get the customer's name before booking (their phone number is already known)."""

WHATSAPP_SALON_PROMPT_SUFFIX = """

You are responding via WhatsApp text. Keep messages short (1-3 sentences). No markdown.
When the customer confirms a specific service AND time, output your short confirmation reply
AND a JSON block like this on a new line (never shown to the customer):
<<<BOOK>>>
{"service_id": "<copy exactly>", "starts_at": "<copy exactly>", "staff_id": "<copy exactly or omit>", "customer_name": "<their name>"}
<<<END_BOOK>>>
Copy service_id, starts_at and staff_id VERBATIM from the AVAILABLE APPOINTMENTS list.
Only include the block once the customer has clearly confirmed a specific time."""


class WhatsAppSettings(BaseModel):
    workspace_id: str
    system_prompt: str
    greeting: str
    model: str
    enabled: bool
    session_window_hours: int
    created_at: datetime
    updated_at: datetime


class WhatsAppSettingsUpdate(BaseModel):
    system_prompt: str | None = Field(default=None, max_length=8000)
    greeting: str | None = Field(default=None, max_length=500)
    model: str | None = Field(default=None, max_length=80)
    enabled: bool | None = None
    session_window_hours: int | None = Field(default=None, ge=1, le=168)


class LocationWhatsAppConfig(BaseModel):
    """Internal model — carries the plain auth token. Never returned to the
    browser; use LocationWhatsAppConfigSafe for that."""

    location_id: str
    workspace_id: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_whatsapp_number: str
    enabled: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LocationWhatsAppConfigSafe(BaseModel):
    """Same as LocationWhatsAppConfig but with the auth token masked.

    Returned by GET/PUT endpoints so the token doesn't go back to the browser."""

    location_id: str
    workspace_id: str
    twilio_account_sid: str
    twilio_auth_token_masked: str  # 'AC12…XXXX' style
    twilio_whatsapp_number: str
    enabled: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LocationWhatsAppConfigUpsert(BaseModel):
    twilio_account_sid: str = Field(..., min_length=10, max_length=64)
    twilio_auth_token: str = Field(..., min_length=10, max_length=128)
    twilio_whatsapp_number: str = Field(..., pattern=r"^\+\d{8,15}$")
    enabled: bool = True


class WhatsAppCapabilities(BaseModel):
    """Static config the frontend uses to render UI."""

    models: list[dict]
    openai_configured: bool
    twilio_configured: bool
    sandbox_number: str
