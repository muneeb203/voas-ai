# Voice integration setup — Vapi + Twilio

V2 Sprint 2 adds AI-answered phone calls via [Vapi](https://vapi.ai) (the voice AI runtime) and [Twilio](https://twilio.com) (the phone number provider). This guide walks you through the one-time setup.

> The whole VOAS app keeps working without these — voice settings just stay "Not configured" in the dashboard. Only flip the keys on when you want real calls to land.

---

## Cost expectations

| Service | What it costs | Free trial? |
|---|---|---|
| Vapi | ~$0.05/min of call time | Yes — first $10 of usage free |
| Twilio | ~$1.15/month per US phone number + $0.0085/min inbound | Yes — $15 credit on signup |
| OpenAI (used inside Vapi for the LLM + GPT-4o-mini) | ~$0.15/1M input tokens | Already covered by Vapi's free credit |

Budget ~$10/month per location for low-volume testing.

---

## 1. Vapi account

1. Sign up at **https://dashboard.vapi.ai** (Google/GitHub OAuth available)
2. Go to **API Keys** → copy:
   - **Private (Server) Key** → goes into `VAPI_API_KEY`
   - **Public Key** → goes into `VAPI_PUBLIC_KEY` (this is browser-safe; used for in-dashboard test calls)
3. *(Optional but recommended)* Go to **Settings → Webhook Secret** → generate one → goes into `VAPI_WEBHOOK_SECRET`. Without this the webhook accepts unsigned requests in dev.

---

## 2. ngrok (dev only)

Vapi needs to POST call events to a public URL. Locally we use [ngrok](https://ngrok.com).

```powershell
# Install (one of):
winget install Ngrok.Ngrok
# OR
scoop install ngrok

# Authenticate once (free account from ngrok.com)
ngrok config add-authtoken <your-token>

# Tunnel local port 8000
ngrok http 8000
```

Copy the `https://...ngrok-free.app` URL. Your `VAPI_SERVER_URL` is that URL **with `/v1/webhooks/vapi` appended**:

```
VAPI_SERVER_URL=https://abc123.ngrok-free.app/v1/webhooks/vapi
```

> The ngrok URL changes every time you restart ngrok on a free plan. Either pay for a static domain ($10/mo) or update `VAPI_SERVER_URL` and restart uvicorn each session.

---

## 3. Twilio account (BYO phone number)

Each location uses its own Twilio account + number, so businesses keep ownership and pay Twilio directly for telephony.

1. Sign up at **https://twilio.com** (free $15 credit applies)
2. Buy a phone number: **Phone Numbers → Buy a number** → pick a US local with Voice capability (~$1.15/mo)
3. From the Twilio console homepage, copy:
   - **Account SID** (looks like `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)
   - **Auth Token** (click "View" to reveal)

> Trial accounts can only call verified numbers. To call your VOAS number from any phone, [upgrade to a paid account](https://www.twilio.com/console/billing/upgrade) (no monthly minimum).

---

## 4. Backend env

Edit `apps/api/.env`:

```bash
VAPI_API_KEY=sk-vapi-...
VAPI_PUBLIC_KEY=pk-vapi-...
VAPI_WEBHOOK_SECRET=whsec-...
VAPI_SERVER_URL=https://abc123.ngrok-free.app/v1/webhooks/vapi
```

Restart uvicorn so the new env is picked up.

---

## 5. Configure in the dashboard

1. **Workspace agent**: http://localhost:3001/integrations/voice → write your system prompt + greeting + pick a voice → **Save & sync to Vapi**. This creates an assistant in your Vapi account that knows your menu.
2. **Per-location phone**: http://localhost:3001/locations → row menu → **Set up voice** → paste your Twilio SID + auth token + phone number → **Save & import**. The number is now wired to your assistant.
3. **Test in browser**: back on the voice settings page → **Test call in browser** → grant mic access → talk to your agent. No phone needed.
4. **Test on a real phone**: call the Twilio number you just configured. Your agent answers.

Conversations show up in the dashboard **Conversations** page in real time as the call proceeds. After the call ends, summary + sentiment fields auto-populate from Vapi's end-of-call analysis.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Vapi keys are not set" warning persists after editing .env | Restart uvicorn — env is read once at startup |
| Webhook events not arriving | Check ngrok is running. In the ngrok inspector (http://localhost:4040) you should see POSTs to /v1/webhooks/vapi. |
| 403 from webhook | Wrong `VAPI_WEBHOOK_SECRET`. Either fix it or unset it (dev convenience: unsigned webhooks accepted). |
| Test call doesn't connect | Open browser DevTools → Console. Most common: mic permission denied, or `VAPI_PUBLIC_KEY` is wrong. |
| Real phone call doesn't connect | In Vapi dashboard → **Phone Numbers** → check the number imported correctly + assigned to your assistant. |
| Call connects but agent says nothing | Vapi assistant has no greeting saved. Check `greeting` field is populated. |

---

## What's NOT covered yet (POST_V1.md)

- **Encryption at rest** for Twilio auth tokens. Stored plain in dev; encrypt before serious customer launch.
- **Outbound calls** (V3 Sprint 1)
- **Real-time call transfer** to human operators (V3)
- **Number provisioning** via our backend (BYO only for now)
