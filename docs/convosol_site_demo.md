# "Talk to Voice AI" button on convosol.com — implementation plan (parked)

> Status: **not building yet** — saved for when we want a live voice demo on the
> main Convosol business site. Decision already made: **reuse the kiosk
> pipeline, do NOT use Vapi** for this.

## The idea

convosol.com (main business site) gets a **"Talk to Voice AI"** button. Pressing
it lets a visitor actually talk to VOAS in the browser — a live demo of the
product.

## Why the kiosk pipeline, not Vapi

The kiosk is already a **browser voice agent** — mic → Deepgram streaming STT →
Claude Haiku (`/chat`) → OpenAI TTS (`/speak`), all over HTTPS/WebSocket. No
telephony involved. That's exactly what a website voice button needs.

Cost per ~2-minute conversation:

| Route | Cost | Notes |
|---|---|---|
| Kiosk pipeline | **~$0.02–0.03** | Deepgram + Haiku + tts-1, existing stack |
| Vapi web SDK | ~$0.15–0.30 | ~$0.05/min platform fee + STT/LLM/TTS margins |

Vapi is ~5–10× more expensive and its value (telephony, phone numbers, routing)
is irrelevant in a browser. Keep Vapi for the real phone-call product only.

## Implementation options (pick by effort)

### Level 1 — zero code, works today
1. Create a **"Convosol Demo" workspace** with a sample menu.
2. Generate a **kiosk token** for it (Self Order page).
3. Button on convosol.com opens `https://voas-ai.convosol.com/kiosk/<token>`
   in a new tab.

### Level 2 — embedded modal (RECOMMENDED)
Embed the same kiosk URL in an **iframe/modal** on convosol.com.
- MUST set `allow="microphone"` on the iframe or the mic prompt fails.
- No backend changes — the kiosk page runs on its own origin.

```html
<iframe
  src="https://voas-ai.convosol.com/kiosk/<token>"
  allow="microphone"
  style="width:100%;height:640px;border:0;border-radius:16px;"
></iframe>
```

### Level 3 — native widget (only if deep visual integration needed)
Custom JS on convosol.com calling the kiosk endpoints directly
(`GET /v1/kiosk/{token}/stt-token`, `POST /chat`, `POST /speak`).
- Requires adding `https://convosol.com` to backend `CORS_ORIGINS`.
- Duplicates the mic/audio logic already in
  `apps/web/app/kiosk/[token]/kiosk-client.tsx` — usually not worth it.

## Before making it public — 3 safeguards

1. **Credits** — kiosk turns are gated on the workspace credit balance; each
   completed order decrements 1. Give the demo workspace a large admin top-up,
   or add a "demo workspace" exemption from decrement.
2. **Abuse** — public endpoint that costs real money per turn. Global rate
   limits exist; before real traffic, add a **per-token daily interaction cap**
   so a prankster can't burn the Anthropic/OpenAI budget overnight.
3. **The prompt / experience** — choose:
   - (a) **Demo ordering** from a sample menu — strongest product proof, works
     today with zero changes; or
   - (b) **Sales assistant** answering questions about VOAS/Convosol — needs a
     small per-workspace variant of the kiosk system prompt
     (`KIOSK_SYSTEM_PROMPT` in `apps/api/app/routers/kiosk.py`).

## Quick start when we pick this up

1. Sign up / use admin to create the "Convosol Demo" workspace + sample menu.
2. Top up kiosk credits generously (admin → workspace → Kiosk tab).
3. Generate the kiosk URL (dashboard → Self Order).
4. Add the Level-2 iframe modal to convosol.com.
5. Add the per-token daily cap (backend) before announcing it anywhere.
