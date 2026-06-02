from datetime import datetime

from pydantic import BaseModel, Field

# Default system prompt for new workspaces. Restaurant-tuned out of the
# box; owners can rewrite the whole thing from the dashboard.
DEFAULT_SYSTEM_PROMPT = """You are the friendly front-desk agent for a restaurant.

Your job:
- Greet warmly. Use the customer's name if they offer it.
- Take orders accurately: items, quantities, modifiers, special requests.
- Quote the total before confirming.
- Confirm pickup vs delivery, time, and contact phone.
- Answer questions about menu, hours, location.
- If the customer is upset, acknowledge it and offer to escalate to a manager.

Order capture (IMPORTANT):
- Use ONLY items from the menu below. If a customer asks for something
  not on the menu, say so politely.
- Once the customer confirms their full order (items + quantities + any
  modifiers + fulfillment method), call the `place_order` tool with the
  structured details. Do NOT call it before the customer is done ordering.
- Get the customer's name and phone number before placing the order.
- After the tool returns, read the confirmation total back to the customer.

Tone: warm, efficient, and confident. Never make promises about timing
or ingredients you aren't sure about. When unsure, say so and offer to
get a human."""

DEFAULT_GREETING = "Hi, thanks for calling. How can I help you today?"

# Common Vapi 11labs voices. The full list is much larger; these are
# the most popular for English restaurant use cases.
AVAILABLE_VOICES = [
    {"id": "rachel", "label": "Rachel — friendly female (US)"},
    {"id": "antoni", "label": "Antoni — warm male (US)"},
    {"id": "bella", "label": "Bella — soft female (US)"},
    {"id": "domi", "label": "Domi — confident female (US)"},
    {"id": "elli", "label": "Elli — youthful female (US)"},
    {"id": "josh", "label": "Josh — deep male (US)"},
]

AVAILABLE_MODELS = [
    {"id": "gpt-4o-mini", "label": "GPT-4o mini (fast, cheap, recommended)"},
    {"id": "gpt-4o", "label": "GPT-4o (smarter, slower)"},
    {"id": "claude-3-5-sonnet", "label": "Claude 3.5 Sonnet"},
]


class VoiceSettings(BaseModel):
    workspace_id: str
    vapi_assistant_id: str | None
    system_prompt: str
    greeting: str
    voice: str
    model: str
    end_call_phrases: list[str] | None
    enabled: bool
    send_order_confirmations: bool = True
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # Computed: true if menu has changed since the assistant was last synced.
    # Drives the "Re-sync menu" button + warning in the dashboard.
    menu_dirty: bool = False
    last_menu_update: datetime | None = None


class VoiceSettingsUpdate(BaseModel):
    system_prompt: str | None = Field(default=None, max_length=8000)
    greeting: str | None = Field(default=None, max_length=500)
    voice: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    end_call_phrases: list[str] | None = None
    enabled: bool | None = None
    send_order_confirmations: bool | None = None


class LocationVoiceConfig(BaseModel):
    location_id: str
    workspace_id: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_phone_number: str
    vapi_phone_number_id: str | None
    enabled: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LocationVoiceConfigSafe(BaseModel):
    """Same as LocationVoiceConfig but with the auth token masked.

    Returned by GET endpoints so the token doesn't go back to the browser."""

    location_id: str
    workspace_id: str
    twilio_account_sid: str
    twilio_auth_token_masked: str            # 'AC1234…XXXX' style
    twilio_phone_number: str
    vapi_phone_number_id: str | None
    enabled: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class LocationVoiceConfigUpsert(BaseModel):
    twilio_account_sid: str = Field(..., min_length=10, max_length=64)
    twilio_auth_token: str = Field(..., min_length=10, max_length=128)
    twilio_phone_number: str = Field(..., pattern=r"^\+\d{8,15}$")
    enabled: bool = True


class VoiceCapabilities(BaseModel):
    """Static config the frontend uses to render UI."""

    voices: list[dict]
    models: list[dict]
    vapi_configured: bool
    vapi_public_key: str | None
