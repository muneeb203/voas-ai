# VOAS AI — External API & Cost Map

> Which external APIs the backend calls, per feature, and where cost accrues.
> Last updated: 2026-07-01. Prices are provider list prices — verify against actual dashboard billing.

## Every external API the backend calls

| # | Feature | Backend endpoint | External API | Model | Whose key / bill | Metered in-app as |
|---|---|---|---|---|---|---|
| 1 | **Kiosk — brain** | `POST /kiosk/{token}/chat` | Anthropic `api.anthropic.com` | `claude-haiku-4-5` | **Yours** (`ANTHROPIC_API_KEY`) | 1 kiosk credit / turn |
| 2 | **Kiosk — voice out (TTS)** | `POST /kiosk/{token}/speak` | OpenAI `api.openai.com` | `tts-1` | **Yours** (`OPENAI_API_KEY`) | not metered (per char) |
| 3 | **Kiosk — voice in (STT)** | *(browser)* | Web Speech API | — | **Free** (device) | — |
| 4 | **WhatsApp — brain** | `POST /webhooks/whatsapp` | OpenAI `api.openai.com` (`/chat/completions`) | `gpt-4o-mini` (default) or `gpt-4o` | **Yours** (`OPENAI_API_KEY`) | `whatsapp_in` / `whatsapp_out` msgs |
| 5 | **WhatsApp — transport** | same | Twilio `api.twilio.com` | — | **BYO per-location** (customer's Twilio) w/ global fallback | per message |
| 6 | **Voice calls** | Vapi webhook + provisioning | Vapi `api.vapi.ai` (bundles Deepgram nova-2 STT + LLM `gpt-4o-mini` + ElevenLabs TTS) | see left | **Yours** (`VAPI_API_KEY`) | voice minutes |
| 7 | **Voice — phone number** | Vapi `/phone-number` | Twilio (BYO number) | — | **BYO per-location** | — |
| 8 | **Dashboard help bot** | `POST /help` | Google Gemini `generativelanguage.googleapis.com` | `gemini-3.1-flash-lite` | **Yours** (`GEMINI_API_KEY`) | gemini usage |
| 9 | Email | tickets/invites | SMTP (Gmail) / Resend | — | Yours | — |
| 10 | DB / Auth / Storage | everywhere | Supabase | — | Yours (flat plan) | — |
| 11 | Error/analytics | — | Sentry + PostHog | — | Yours (flat plan) | — |

## The paid-per-use APIs (your keys)

| Provider | Used by | Model | List price | Rough per-unit |
|---|---|---|---|---|
| **Anthropic** | Kiosk brain | `claude-haiku-4-5` | $1.00 in / $5.00 out per MTok | ~$0.0015 / turn → ~$0.01 / order |
| **OpenAI (TTS)** | Kiosk voice | `tts-1` | ~$15 / 1M chars | ~$0.001 / spoken reply |
| **OpenAI (LLM)** | WhatsApp brain | `gpt-4o-mini` | ~$0.15 in / $0.60 out per MTok | ~$0.001–0.002 / message |
| **OpenAI (LLM)** | WhatsApp (if switched) | `gpt-4o` | ~$2.50 in / $10 out per MTok | ~15× more than mini |
| **Vapi** | Voice calls | bundle (STT+LLM+TTS) + Twilio | per minute | ~$0.10–0.20 / min (biggest cost) |
| **Gemini** | Help bot | `gemini-3.1-flash-lite` | cheapest tier | fractions of a cent / query |

## Cost ranking per interaction

```
Voice call        ~$0.10–0.20 / min      ← by far the biggest
WhatsApp order    ~$0.005–0.02           (your OpenAI + their Twilio)
Kiosk order       ~$0.01                 (Anthropic + OpenAI TTS)
Help bot query    ~$0.0005               (negligible)
```

## Not on your bill (BYO)

**Twilio** (WhatsApp messages + voice phone numbers) is configured per-location in the DB
(`location_whatsapp_config`) — i.e. the restaurant's own Twilio account pays for transport.
A global `TWILIO_*` fallback exists in config for testing only.

## Cost drivers to watch

- **Menu size** — the full menu is injected into the system prompt every kiosk/WhatsApp turn, so
  a big menu raises input-token cost on every message.
- **Conversation length** — history is re-sent each turn; token 5 turns in costs more than turn 1.
- **`gpt-4o` toggle** — a workspace switching WhatsApp from `gpt-4o-mini` to `gpt-4o` is ~15× pricier.
- **Voice minutes** — the dominant cost; Vapi bills per minute and bundles multiple providers + Twilio.

## Key config note

`ANTHROPIC_API_KEY` (kiosk brain) is read by `apps/api/app/config.py` but was **missing from
`apps/api/.env.example`** — add it there so kiosk setup is self-documenting. Kiosk chat returns
"AI not configured" until the key is set; kiosk TTS falls back to browser TTS without `OPENAI_API_KEY`.
