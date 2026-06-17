# VOAS AI — Roadmap & Sprint Guide

> Single source of truth for **what has been built, what is in progress, and what comes next**.
> Update the status column as work completes.
> For full technical detail on any sprint, see `SPRINTS.md`.

---

## At a Glance

| Version | Theme | Goal | Status |
|---|---|---|---|
| **V1** | Foundation | Marketing site + auth + dashboard shell + admin panel | ✅ Complete |
| **V2** | Real Conversations | Voice + WhatsApp + orders + analytics | 🔄 In Progress |
| **V3** | Scale & Expand | Outbound + flow builder + analytics depth + second vertical | ⏳ Not started |

---

## V1 — Foundation (Complete ✅)

Everything a business needs to sign up, set up, and get human support.
No real AI conversations yet — but the product looks and feels complete.

| Sprint | What Was Built | Status |
|---|---|---|
| **1 — Scaffold** | Monorepo (pnpm), Next.js 14, FastAPI, Supabase schema + RLS, CI | ✅ Done |
| **2 — Auth & Marketing** | Homepage, pricing, contact form, signup/login, email verify, Google OAuth, password reset, workspace creation on first login | ✅ Done |
| **3 — Dashboard Shell** | Sidebar, topbar, settings, locations CRUD, team invites + roles | ✅ Done |
| **4 — Support Tickets** | Create ticket, reply, resolve, attachments, email notifications | ✅ Done |
| **5 — Admin Panel** | Admin login, workspaces list, impersonation, users, support inbox, audit log, contact submissions | ✅ Done |
| **6 — Polish + Deploy** | Error/loading/empty states, Sentry, PostHog, deploy to DigitalOcean + Supabase Cloud | ✅ Done |

**Production URL:** https://seahorse-app-mzw2u.ondigitalocean.app

---

## V2 — Real Conversations (In Progress 🔄)

The AI agent goes live. Voice and WhatsApp work end-to-end.
Customers call or message → AI responds → orders land in the dashboard.

---

### Sprint 1 — Data Model ✅ Done

Built the database foundation for all V2 features.

**What was built:**
- `conversations` table (channel, status, sentiment, outcome, summary)
- `conversation_messages` table (role: customer / agent / system)
- `orders` table (items_json, total_cents, payment_status)
- `customers` table (phone, total_orders, total_spent_cents)
- `menu_categories`, `menu_items`, `menu_modifier_groups`, `menu_modifier_options`
- Full RLS policies on all new tables
- Real `/conversations`, `/orders`, `/knowledge-base` dashboard pages
- Menu editor (categories → items → modifiers)

---

### Sprint 2 — Voice Integration ✅ Done

A customer can call a phone number and the AI takes their order.

**What was built:**
- Vapi assistant per workspace (configurable prompt, voice, model)
- Twilio BYO phone number per location
- Webhook handler for Vapi events (call start, transcript, tool calls, end-of-call report)
- `place_order` tool call → creates order row from voice
- Conversations + messages saved in real time
- Sentiment + summary auto-generated after call ends
- Test call button in dashboard (browser mic, no phone needed)
- Menu sync dirty-flag + re-sync button
- `/integrations/voice` settings page

**How it works end-to-end:**
```
Customer calls Twilio number
→ Vapi handles voice AI (STT + LLM + TTS)
→ Webhook events come to our backend
→ Conversation + messages saved to Supabase
→ On order confirmation: place_order tool → orders table
→ Business sees everything in /conversations and /orders
```

---

### Sprint 3 — WhatsApp Integration 🔄 In Progress

Same conversation brain as voice, but over WhatsApp text.

**What needs to be built:**
- Twilio WhatsApp webhook handler (`POST /v1/webhooks/whatsapp`)
- AI service for WhatsApp: reads conversation history → calls OpenAI → sends reply via Twilio API
- Order capture via structured `<<<ORDER>>>` marker in AI response
- `location_whatsapp_config` table (Twilio WhatsApp number per location)
- `whatsapp_settings` table (system prompt, model, session window per workspace)
- `/integrations/whatsapp` dashboard page (same pattern as voice page)
- Replace "Coming soon" WhatsApp card on integrations page

**How it works end-to-end:**
```
Customer messages WhatsApp number
→ Twilio posts to our webhook
→ We find the workspace by phone number
→ AI reads conversation history (24h session window) + menu context
→ AI replies via Twilio WhatsApp API
→ On order: <<<ORDER>>> marker → place_order → orders table
→ Business sees conversation in /conversations + order in /orders
```

**New env var needed:** `OPENAI_API_KEY` on backend.

**Manual setup for business owner:**
1. Twilio console → Messaging → Try WhatsApp sandbox
2. Set webhook URL to `https://<backend>.ondigitalocean.app/v1/webhooks/whatsapp`
3. Customers send `join <keyword>` to +14155238886 to connect (sandbox)

---

### Analytics Dashboard 🔄 In Progress

Turn the placeholder `/analytics` page into real charts from live data.

**What needs to be built:**

**Backend:**
- `analytics_service.py` — queries conversations, orders, customers for aggregates
- `GET /v1/workspaces/{id}/analytics/summary?days=30` — full analytics payload
- `GET /v1/workspaces/{id}/analytics/today` — lightweight today stats

**Frontend:**
- Real `/analytics` page with:
  - KPI cards (conversations, orders, revenue, avg sentiment)
  - Conversations over time bar chart (daily, 30 days)
  - Revenue over time bar chart
  - Channel breakdown (voice vs WhatsApp)
  - Outcome breakdown (order placed, question answered, escalated)
  - Top menu items ranked list
  - Busiest hours of day (0–23)
  - Customer stats (total, new, returning)
  - Sentiment gauge
- Update dashboard home `/dashboard` stat cards to show real today numbers
- CSS-only charts — no external charting library

---

### Sprint 4 — Toast POS Integration ⏳ Pending

Orders placed via voice/WhatsApp push directly into Toast as real POS orders.

**What will be built:**
- Toast OAuth flow (business connects Toast account from dashboard)
- Menu sync: Toast → VOAS knowledge base (auto-import)
- Order push: VOAS order → Toast order on placement
- Two-way status sync: Toast order status updates show in VOAS
- Background job system (Celery + Redis) for sync

**Why this matters:**
> Before this sprint, orders live only in VOAS. After this sprint, an AI-taken order appears in the kitchen printer just like a human-taken order. This is the pitch that closes restaurant customers.

**Dependency:** WhatsApp + Voice must be stable and tested before starting this.

---

### Sprint 5 — Billing + Live Chat ⏳ Pending

Charge money. Support customers in real time.

**What will be built:**

**Stripe billing:**
- Stripe Customer + Subscription created on workspace creation
- Plan upgrade/downgrade from dashboard
- Usage-based overages (per minute, per message)
- Invoice history in dashboard
- Failed payment → dunning → suspend after 14 days

**Live chat:**
- Supabase Realtime websocket channel per support session
- "Chat with us" button in dashboard → opens live chat widget
- Admin online/offline indicator
- Falls back to ticket if no admin is online
- Chat history saved as conversation

**Why this matters:**
> This is when the product generates revenue. Don't start this until you have at least 2–3 customers who want to pay — build to their needs, not speculatively.

---

## V2 Completion Checklist

Before calling V2 "done" and moving to V3, all of these must be true:

- [ ] Voice: customer calls → order lands in dashboard ✅ (working)
- [ ] WhatsApp: customer messages → order lands in dashboard 🔄 (in progress)
- [ ] Analytics: real charts with real data 🔄 (in progress)
- [ ] Toast POS: AI order lands in Toast kitchen printer ⏳
- [ ] Billing: businesses are paying monthly ⏳
- [ ] First 10 paying customers onboarded ⏳

---

## V3 — Scale & Expand (Not started ⏳)

Only start V3 after V2 is complete and you have paying customers.

| Sprint | Theme | What |
|---|---|---|
| **1** | Outbound Campaigns | Win-back, review requests, promos via voice/WhatsApp/SMS |
| **2** | Analytics Deep Dive | Real charts, funnel, LTV cohorts, exportable reports |
| **3** | No-Code Flow Builder | Visual drag-drop editor for conversation flows |
| **4** | Public API | API keys, webhooks, developer portal, SDK |
| **5** | Second Vertical | Dental/salon: service catalog, Google Calendar bookings |
| **6** | Voice Stack Migration | Own STT+TTS stack (Deepgram + ElevenLabs), off Vapi |

---

## Current Priorities (Right Now)

```
1. ✅ Deploy stable (done)
2. 🔄 WhatsApp integration (in progress — being built in separate AI chat)
3. 🔄 Analytics dashboard (in progress — being built in separate AI chat)
4. ⏳ Smoke test WhatsApp end-to-end (message → conversation → order)
5. ⏳ Toast POS (Sprint 4) — after WhatsApp is tested
```

---

## Feature Ideas Outside the Sprint Plan

These came up during development and are worth building but don't fit a numbered sprint:

| Feature | Value | Effort | When |
|---|---|---|---|
| Customer profiles page (`/customers`) | High — shows who's ordering | Low — data already exists | After analytics |
| Order confirmation via WhatsApp | High — customer experience | Low — reuse WhatsApp sender | During/after Sprint 3 |
| Real-time dashboard (Supabase Realtime) | Medium — live call indicator | Medium | Before V3 |
| SMS channel (Twilio SMS, no WhatsApp) | Medium — fallback channel | Low — same as WhatsApp minus AI complexity | V2.5 |

---

## Tech Stack (Locked)

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | 14, strict mode |
| UI | Tailwind CSS + shadcn/ui | 3.4 |
| Backend | Python + FastAPI + Pydantic v2 | 3.12 / 0.115 / 2.9 |
| Database | Supabase (Postgres + Auth + RLS) | Cloud |
| Voice AI | Vapi + Twilio (BYO) | — |
| WhatsApp | Twilio WhatsApp API | — |
| AI model | OpenAI (gpt-4o-mini default) | — |
| Hosting | DigitalOcean App Platform | — |
| Package manager | pnpm (frontend), pip (backend) | 9 |

> **Do not change the stack without explicit approval.** Adding a dependency requires asking first.

---

## Useful Commands

```powershell
# Run frontend locally (http://localhost:3001)
pnpm dev

# Run backend locally (http://localhost:8000)
cd apps\api
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# Push a database migration to Supabase Cloud
supabase db push

# Build frontend (same as what DO runs)
pnpm --filter @voas/web build

# Typecheck
pnpm --filter @voas/web typecheck

# Lint
pnpm --filter @voas/web lint
```

---

## Repo Structure (Key Paths)

```
apps/web/                          Frontend (Next.js)
  app/(dashboard)/                 Dashboard pages
  app/(auth)/                      Login / signup pages
  app/admin/                       Admin panel
  app/actions/                     Server actions (form handlers)
  components/dashboard/            Dashboard components
  lib/api/                         API client functions (one file per domain)
  lib/types.ts                     All shared TypeScript types
  lib/auth/                        Auth helpers + session management

apps/api/                          Backend (FastAPI)
  app/routers/                     HTTP endpoints (thin — no logic here)
  app/services/                    Business logic (all queries here)
  app/models/                      Pydantic models (request + response)
  app/integrations/                Third-party API clients (Vapi, Twilio, etc.)
  app/core/                        Supabase client, JWT, exceptions, logging

supabase/migrations/               SQL migrations (run in order)
CLAUDE.md                          Master spec — read before writing any code
SPRINTS.md                         Full technical sprint detail
ROADMAP.md                         This file — phases + status overview
```

---

*Last updated: V2 Sprint 3 + Analytics in progress. Deployment stable on DigitalOcean.*
