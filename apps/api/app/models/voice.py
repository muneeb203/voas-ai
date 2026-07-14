from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Supported voice agent languages. Adding a new one requires (1) extending
# this Literal + AVAILABLE_LANGUAGES, (2) extending the migration's CHECK
# constraint, (3) adding entries to DEFAULT_SYSTEM_PROMPT_BY_LANG +
# DEFAULT_GREETING_BY_LANG, (4) adding an entry to vapi.LANGUAGE_CONFIG.
VoiceLanguage = Literal["en", "ar", "ur"]

AVAILABLE_LANGUAGES = [
    {"id": "en", "label": "English"},
    {"id": "ar", "label": "العربية (Arabic)"},
    {"id": "ur", "label": "اردو (Urdu)"},
]

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

_AR_PROMPT = """أنت موظف الاستقبال الودود لمطعم.

وظيفتك:
- استقبل العميل بحرارة. استخدم اسمه إن قدّمه.
- خذ الطلبات بدقة: الأصناف، الكميات، التعديلات، والطلبات الخاصة.
- اذكر المجموع قبل التأكيد.
- أكّد طريقة الاستلام (استلام/توصيل)، الوقت، ورقم الهاتف.
- أجب على أسئلة القائمة وساعات العمل والموقع.
- إن كان العميل منزعجاً، اعترف بذلك واعرض تحويله إلى المدير.

التقاط الطلب (مهم):
- استخدم فقط الأصناف من القائمة أدناه. إن طلب العميل صنفاً غير موجود
  فاعتذر بأدب.
- بعد تأكيد العميل لطلبه الكامل (الأصناف + الكميات + التعديلات + طريقة
  الاستلام)، نادِ أداة `place_order` بالتفاصيل المُهيكلة. لا تستدعها قبل
  أن يُنهي العميل طلبه.
- احصل على اسم العميل ورقم هاتفه قبل تأكيد الطلب.
- بعد عودة الأداة، اقرأ المجموع للعميل.

النبرة: دافئة، فعّالة، وواثقة. لا تَعِد بأوقات أو مكوّنات لست متأكداً منها.
عند الشك، قُل ذلك واعرض تحويل المكالمة لإنسان."""

_UR_PROMPT = """آپ ایک ریسٹورنٹ کے دوستانہ فرنٹ ڈیسک ایجنٹ ہیں۔

آپ کا کام:
- گرم جوشی سے استقبال کریں۔ اگر گاہک اپنا نام بتائے تو استعمال کریں۔
- آرڈر درست لیں: آئٹمز، مقدار، ترامیم، اور خصوصی درخواستیں۔
- تصدیق سے پہلے کل قیمت بتائیں۔
- پک اپ یا ڈلیوری، وقت، اور رابطہ نمبر کی تصدیق کریں۔
- مینو، اوقاتِ کار، اور مقام سے متعلق سوالات کا جواب دیں۔
- اگر گاہک پریشان ہو، تو اس کا اعتراف کریں اور مینیجر سے بات کرانے کی پیشکش کریں۔

آرڈر لیتے وقت (اہم):
- صرف نیچے دیے گئے مینو سے آئٹمز استعمال کریں۔ اگر گاہک ایسی چیز مانگے
  جو مینو پر نہیں، تو شائستگی سے بتا دیں۔
- جب گاہک پورے آرڈر کی تصدیق کرے (آئٹمز + مقدار + ترامیم + پک اپ/ڈلیوری)،
  تو `place_order` ٹول کو منظم تفصیلات کے ساتھ کال کریں۔ گاہک کے مکمل
  ہونے سے پہلے کال مت کریں۔
- آرڈر دینے سے پہلے گاہک کا نام اور فون نمبر حاصل کریں۔
- ٹول کے واپس آنے کے بعد، تصدیقی کل قیمت گاہک کو پڑھ کر سنائیں۔

لہجہ: گرم، تیز، اور پراعتماد۔ ایسے اوقات یا اجزاء کا وعدہ نہ کریں جن کا
آپ کو یقین نہیں۔ شک ہو تو بتا دیں اور انسان سے بات کروانے کی پیشکش کریں۔"""

DEFAULT_SYSTEM_PROMPT_BY_LANG: dict[str, str] = {
    "en": DEFAULT_SYSTEM_PROMPT,
    "ar": _AR_PROMPT,
    "ur": _UR_PROMPT,
}

DEFAULT_GREETING = "Hi, thanks for calling. How can I help you today?"

DEFAULT_GREETING_BY_LANG: dict[str, str] = {
    "en": DEFAULT_GREETING,
    "ar": "مرحباً، شكراً لاتصالك. كيف يمكنني مساعدتك اليوم؟",
    "ur": "السلام علیکم، کال کرنے کا شکریہ۔ میں آپ کی کیا مدد کر سکتا ہوں؟",
}

# Salon vertical: booking-oriented defaults, seeded when a salon workspace first
# initializes voice settings. Services are injected into the prompt at sync time;
# live open times come from the check_availability tool, never this text.
SALON_DEFAULT_SYSTEM_PROMPT = """You are the friendly front-desk agent for a salon.

Your job:
- Greet warmly. Use the customer's name if they offer it.
- Help customers book appointments: which service, which day/time, and which
  stylist if they have a preference.
- Answer questions about services, prices, hours, and location.
- If the customer is upset, acknowledge it and offer to escalate to a manager.

Booking (IMPORTANT):
- Offer ONLY the services listed below. If asked for something not offered, say
  so politely.
- To find open times, call the `check_availability` tool with the service_id
  (copied exactly from the services list) and the date the customer wants. Read
  back the real open times it returns — never invent or guess a time.
- Once the customer confirms a specific time, call `book_appointment` with the
  service_id, starts_at, and staff_id COPIED EXACTLY from the availability
  result, plus the customer's name and phone number.
- If a customer is arriving for an existing appointment, use `check_in` with
  their name.
- After a tool returns, confirm the details back to the customer.

Tone: warm, efficient, confident. Never promise a time you haven't confirmed via
check_availability. When unsure, say so and offer a human."""

SALON_DEFAULT_GREETING = "Hi, thanks for calling! Would you like to book an appointment?"

# Voice roster. Each entry has:
#   id        — ElevenLabs voice id (or a friendly alias resolved in vapi._VOICE_ID_MAP)
#   label     — shown in the dashboard dropdown
#   best_for  — list of language codes where this voice sounds most natural;
#               voices tagged ["en"] still work for Arabic/Urdu via
#               eleven_multilingual_v2 but will have a Western accent.
#
# Multilingual voice IDs are ElevenLabs built-in voice IDs. Verify / browse
# more at https://elevenlabs.io/voice-library (filter by language).
AVAILABLE_VOICES = [
    # ── English-primary voices ───────────────────────────────────────────────
    {"id": "rachel", "label": "Rachel — friendly female (EN)", "best_for": ["en"]},
    {"id": "antoni", "label": "Antoni — warm male (EN)", "best_for": ["en"]},
    {"id": "bella", "label": "Bella — soft female (EN)", "best_for": ["en"]},
    {"id": "domi", "label": "Domi — confident female (EN)", "best_for": ["en"]},
    {"id": "elli", "label": "Elli — youthful female (EN)", "best_for": ["en"]},
    {"id": "josh", "label": "Josh — deep male (EN)", "best_for": ["en"]},
    # ── Multilingual voices (natural accent in AR / UR / EN) ─────────────────
    # These use eleven_multilingual_v2 and are optimised for cross-language
    # naturalness. The IDs below are ElevenLabs built-in (pre-made) voices;
    # they work directly without being in _VOICE_ID_MAP.
    {
        "id": "9BWtsMINqrJLrRacOk9x",
        "label": "Aria — conversational female (multilingual)",
        "best_for": ["en", "ar", "ur"],
    },
    {
        "id": "CwhRBWXHgkmLlGpnJKNJ",
        "label": "Roger — deep male (multilingual)",
        "best_for": ["en", "ar", "ur"],
    },
    {
        "id": "nPczCjzI2devNBz1zQrb",
        "label": "Brian — professional male (multilingual)",
        "best_for": ["en", "ar", "ur"],
    },
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
    language: VoiceLanguage = "en"
    end_call_phrases: list[str] | None
    enabled: bool
    send_order_confirmations: bool = True
    last_synced_at: datetime | None
    sync_status: str = "synced"  # pending | synced | error
    sync_error: str | None = None
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
    language: VoiceLanguage | None = None
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
    twilio_auth_token_masked: str  # 'AC1234…XXXX' style
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
    languages: list[dict]
    vapi_configured: bool
    vapi_public_key: str | None
