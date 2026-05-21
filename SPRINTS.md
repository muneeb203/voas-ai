# SPRINTS.md — VOAS AI Build Plan

> Three major versions, each shippable on its own. Each version is broken into sprints with concrete deliverables, acceptance criteria, and dependencies. Read `CLAUDE.md` first.

---

## At-a-Glance Roadmap

| Version | Theme | Duration | Outcome |
|---|---|---|---|
| **V1** | Foundation & Shell | 6–8 weeks | Marketing site live, businesses can sign up, manage workspace, get support. No real integrations. |
| **V2** | Real Conversations | 8–10 weeks | Voice + WhatsApp inbound work end-to-end. Toast/Square integrations. Live chat. Billing. |
| **V3** | Scale & Expand | 10–12 weeks | Outbound, flow builder, analytics, public API, second vertical (dental/salon). |

Total to a "real" product: ~24–30 weeks of focused work (~6–7 months).

---

# V1 — Foundation & Shell (6–8 weeks)

**Goal:** Have a credible, production-deployed product surface that lets businesses sign up, set up their workspace, and get human support — even though no real AI conversations happen yet. This is what you show to early customers, investors, and partners.

**Success criteria:**
- A stranger can land on voas.ai, understand the product, sign up, create a workspace, add locations, invite team members, and submit a support ticket.
- A VOAS admin can log into the admin panel, see all workspaces, respond to tickets, and impersonate a workspace for debugging.
- Every action is logged. RLS works. Auth is secure. Deployment is stable.
- The dashboard *looks* like a real product even though most pages are placeholders.

---

## V1 Sprint 1 — Scaffold & Foundation (Week 1–2)

### What gets built

**Repo & tooling:**
- Monorepo (pnpm workspaces)
- `apps/web` (Next.js 14 + TS + Tailwind + shadcn/ui)
- `apps/api` (FastAPI + Python 3.11 + Pydantic v2)
- `supabase/` with migrations folder
- `.github/workflows/` CI pipelines (lint + typecheck + smoke tests)
- README, CLAUDE.md, SPRINTS.md
- Pre-commit hooks (lint, format)

**Supabase setup:**
- Project created
- Full V1 schema migration (all tables in CLAUDE.md §4)
- RLS policies on every table
- Auth providers configured (email, Google)
- Seed script for dev (sample workspace, admin user, test tickets)

**Frontend foundation:**
- Root layout with theme provider
- Tailwind config with brand colors
- shadcn/ui base components installed
- Supabase client (browser + server)
- Auth middleware for route gating
- Error boundary + not-found page

**Backend foundation:**
- FastAPI app with config (pydantic-settings)
- Supabase client (service role)
- JWT verification dependency
- CORS configured
- Health endpoint (`GET /v1/health`)
- Structured logging
- Dockerfile

### Acceptance criteria

- [ ] `pnpm install && pnpm dev` runs both web and api locally
- [ ] Migrations apply cleanly to a fresh Supabase project
- [ ] `curl localhost:8000/v1/health` returns `{"data": {"status": "ok"}}`
- [ ] Frontend loads at localhost:3000 with placeholder homepage
- [ ] CI runs on every PR

---

## V1 Sprint 2 — Auth & Marketing Site (Week 2–3)

### What gets built

**Marketing site (public):**
- `/` Homepage: hero, "how it works" (3 steps), value props (3 cards), customer logos placeholder, CTA, footer
- `/product` Product page: voice, WhatsApp, dashboard, integrations sections
- `/pricing` Pricing page: 3 tiers (Starter $149, Growth $299, Scale $499) + "Talk to sales" enterprise
- `/contact` Contact page with form (name, email, company, phone, message) — posts to backend, stores in `contact_submissions`
- Marketing layout: top nav + footer
- Fully responsive

**Auth flow:**
- `/signup` page: email + password + full name → Supabase signup → email verification sent
- `/login` page: email + password OR Google OAuth → on success, redirect to dashboard
- `/verify-email` confirmation page
- `/forgot-password` + `/reset-password` flows
- Email verification required before dashboard access
- First-time login: backend creates workspace + makes user owner
- `/logout` action

**Workspace bootstrap:**
- On first dashboard visit after signup, show "Welcome — let's set up your workspace" wizard:
  1. Workspace name
  2. Vertical (Restaurant for now; dropdown for future)
  3. Add first location (name, address, phone)
- Save → land in dashboard

### Acceptance criteria

- [ ] Marketing site fully responsive on mobile/tablet/desktop
- [ ] Contact form submission appears in `contact_submissions` table
- [ ] User can sign up, receive verification email, click link, log in
- [ ] Google OAuth works end-to-end
- [ ] Password reset works end-to-end
- [ ] First-time user completes setup wizard and lands in dashboard
- [ ] Protected routes redirect to /login when unauthenticated

---

## V1 Sprint 3 — Dashboard Shell & Core Pages (Week 3–5)

### What gets built

**Dashboard shell:**
- Sidebar navigation: Dashboard, Conversations, Orders, Knowledge Base, Integrations, Analytics, Team, Settings, Support
- Top bar: workspace switcher (if user has multiple workspaces), notifications icon (placeholder), user avatar menu
- Mobile: hamburger menu, slide-out sidebar
- Active route highlighting

**Dashboard home page:**
- Welcome message with workspace name
- "Get started" checklist (placeholders): Connect POS, Set up voice number, Customize menu, Invite team
- Stats placeholder cards (calls today, orders today, etc. — all "—" with "Coming soon" badge)

**Settings page (functional):**
- Workspace tab: name, slug, vertical
- Profile tab: full name, email (read-only), avatar upload
- Billing tab: placeholder showing current plan (read-only)
- Danger zone: delete workspace (with confirmation modal — soft delete, sets status = 'deleted')

**Locations page (functional):**
- List view with table: name, address, phone, status, actions
- "Add location" button → modal with form
- Edit location → modal with form
- Delete location → confirmation
- Set business hours via UI (per day, open/close times)
- Empty state if no locations

**Team page (functional):**
- Members list: avatar, name, email, role, joined date, actions
- "Invite member" button → modal with email + role selector
- Invite sent → creates row in `invitations`, sends email via Resend with magic link
- `/accept-invite?token=...` page handles invite acceptance
- Owner can change member roles
- Owner can remove members (with confirmation)
- Can't remove yourself if you're the only owner
- Pending invitations section: shows pending, can resend or revoke

**Placeholder pages (visible in sidebar, "Coming soon" content):**
- Conversations: nice empty state with "Connect your first channel in V2"
- Orders: same pattern
- Knowledge Base: same pattern
- Integrations: same pattern, with grayed-out cards showing what's coming (Toast, Square, WhatsApp, Twilio, Stripe)
- Analytics: same pattern with placeholder chart silhouettes

### Acceptance criteria

- [ ] Dashboard responsive on mobile
- [ ] Workspace owner can rename workspace
- [ ] Owner can add/edit/delete locations
- [ ] Owner can invite a team member; member receives email; member accepts; member shows in list
- [ ] Owner can change roles and remove members
- [ ] Non-owners see appropriate UI (can't delete workspace, can't change roles unless they have permission)
- [ ] All placeholder pages render without errors and show clear "coming in V2" messaging

---

## V1 Sprint 4 — Support System (Tickets) (Week 5–6)

### What gets built

**User-facing support (in dashboard):**
- `/support` page: list of tickets with status, subject, created date, priority
- "New ticket" button → form: subject, category, priority (default normal), body, attachments
- Ticket detail page: shows ticket info, threaded messages, reply form, "mark resolved" button
- Email notifications when admin replies

**Backend:**
- `POST /v1/tickets` — create ticket
- `GET /v1/tickets` — list tickets for workspace
- `GET /v1/tickets/{id}` — get ticket detail with messages
- `POST /v1/tickets/{id}/messages` — add reply
- `PATCH /v1/tickets/{id}` — update status
- File upload to Supabase Storage for attachments

### Acceptance criteria

- [ ] User can create a ticket
- [ ] User receives email confirmation
- [ ] User can reply to a ticket
- [ ] User can mark their own ticket resolved
- [ ] Attachments upload and display correctly
- [ ] Ticket list filters by status (open, in progress, resolved)

---

## V1 Sprint 5 — Admin Panel (Week 6–8)

### What gets built

**Admin auth:**
- `/admin/login` page (separate, not linked from public site)
- Email + password (no signup — admins manually provisioned)
- 2FA via TOTP (skippable in dev, required in production)
- Separate session, 8-hour timeout
- Provisioning script: CLI command to create admin user from terminal

**Admin shell:**
- Distinct visual treatment (red accent, "Admin" badge in topbar)
- Sidebar: Workspaces, Users, Support Inbox, Audit Log, Contact Submissions, Settings
- "Impersonating" banner shown across top when active

**Workspaces management:**
- List view: search by name, filter by plan/status, paginated
- Workspace detail: tabs for Overview, Members, Locations, Tickets, Audit Log
- Actions: suspend, restore, delete, impersonate

**Impersonation:**
- Click "View as" on a workspace → admin token scoped to workspace → admin sees dashboard exactly as a member would
- Banner persists: "Viewing as [Workspace Name] — [Exit]"
- Every action during impersonation logged with admin_id + workspace_id
- "Exit" returns to admin panel

**Users management:**
- List all users across all workspaces
- Filter by workspace, role, status
- Click user → see their workspace memberships, last login

**Support inbox (admin side):**
- All tickets across all workspaces
- Filters: status, priority, assigned, workspace
- Click ticket → see full conversation
- Reply (sends email to user)
- Internal notes (admin-only, not visible to user)
- Assign to admin
- Change status
- Bulk actions: assign, resolve, archive

**Audit log:**
- List view: timestamp, actor, action, resource, metadata
- Filters: date range, actor, action type, workspace
- Detail view for any log entry
- Export to CSV

**Contact submissions:**
- List submissions from marketing form
- Click to see full message
- Status: new, contacted, qualified, closed
- Notes field per submission

### Acceptance criteria

- [ ] Admin can log in with 2FA (or skippable in dev)
- [ ] Admin sees workspaces list, can search and filter
- [ ] Admin can impersonate, see workspace's dashboard, exit
- [ ] Every impersonation logged
- [ ] Admin can reply to any ticket
- [ ] Admin can add internal notes
- [ ] Audit log captures: workspace created, member invited, member removed, location added, ticket created, ticket resolved, admin login, impersonation start/end
- [ ] Contact submissions visible and filterable

---

## V1 Sprint 6 — Polish, QA, Deploy (Week 7–8)

### What gets built

**Polish:**
- Every page has loading skeleton
- Every page has empty state
- Every error has user-friendly message
- Toast notifications for all actions
- Form validation messages
- Tooltips on icons
- Keyboard navigation works
- Focus states visible everywhere

**Performance:**
- Lighthouse score 90+ on marketing pages
- Largest Contentful Paint < 2s
- Images optimized (Next/Image)
- Code splitting working

**Cross-cutting:**
- Sentry installed (frontend + backend)
- PostHog installed with key events tracked
- Email templates polished (verification, invite, ticket reply, password reset)
- 404 page, 500 page

**Testing:**
- Backend smoke tests for all V1 endpoints
- One Playwright E2E test for critical path
- Manual QA checklist completed

**Deployment:**
- Vercel project for `apps/web`
- Railway project for `apps/api`
- Production Supabase project (separate from dev)
- Custom domain configured (voas.ai or chosen domain)
- SSL certificates
- Production environment variables set
- Smoke test on production

**Documentation:**
- `README.md` with setup instructions
- `docs/deployment.md`
- `docs/onboarding.md` for new developers
- API documentation auto-generated from FastAPI (`/docs`)

### Acceptance criteria

- [ ] Lighthouse 90+ on marketing
- [ ] Zero TypeScript errors
- [ ] Zero Sentry errors in 24-hour smoke test
- [ ] Production deployed and accessible at voas.ai
- [ ] At least 1 real test user successfully signs up and uses the dashboard end-to-end
- [ ] All documentation complete

---

# V2 — Real Conversations (8–10 weeks)

**Goal:** Make the AI agent real. Voice and WhatsApp work end-to-end. First POS integration ships. Businesses can actually take orders. This is when you start charging money.

**Success criteria:**
- A customer can call a VOAS phone number and place a real order that lands in Toast
- A customer can WhatsApp a VOAS number and get a complete conversational ordering experience
- The business sees the conversation in their dashboard with transcript, sentiment, and outcome
- Live chat support works (admin online, real-time)
- Stripe billing collects monthly subscription fees
- First 10 paying customers onboarded

---

## V2 Sprint 1 — Conversation Brain & Data Model (Week 1–2)

### What gets built

**Schema additions:**
- `conversations` table (id, workspace_id, location_id, channel, customer_phone, customer_name, started_at, ended_at, duration_seconds, status, sentiment, summary, transcript, recording_url)
- `conversation_messages` table (id, conversation_id, role [user/agent/system], content, audio_url, timestamp)
- `orders` table (id, conversation_id, workspace_id, location_id, status, total_cents, items_json, customer_phone, payment_status, pos_order_id)
- `customers` table (id, workspace_id, phone, name, email, total_orders, total_spent_cents, first_seen, last_seen, tags)
- `menu_items`, `menu_modifiers`, `menu_categories` (the knowledge base)

**Backend:**
- Conversation service: create, append messages, end, summarize
- Customer service: identify by phone, link across channels
- Menu service: import from POS, edit via dashboard

**Frontend:**
- Conversations page becomes real: list view with filters (channel, date, status, sentiment)
- Conversation detail page: transcript, audio playback (if voice), customer info, related order, summary, sentiment, "escalate to human" action
- Knowledge Base page real: menu editor (categories → items → modifiers), import from CSV, search, edit

### Acceptance criteria

- [ ] Conversations and orders can be created via API
- [ ] Conversations page displays mock conversation data correctly
- [ ] Menu editor allows full CRUD on items, categories, modifiers

---

## V2 Sprint 2 — Voice Integration (Vapi) (Week 3–4)

### What gets built

**Vapi integration:**
- Provision phone numbers via Twilio/Vapi for each location
- Configure Vapi assistant per workspace with workspace's menu/system prompt
- Webhook endpoint to receive call events (started, message, ended)
- Transcripts streamed and saved to `conversations` + `conversation_messages`
- Audio recordings uploaded to Supabase Storage
- Sentiment analysis on call end (use OpenAI or Anthropic)
- Summary generation on call end

**Dashboard:**
- "Voice" section in Integrations page: assign phone number per location
- Test call button (Vapi web call)
- Live calls indicator on dashboard home

### Acceptance criteria

- [ ] User can buy/assign a phone number to a location
- [ ] Calling the number connects to Vapi assistant with workspace's menu loaded
- [ ] Conversation logs in real time to dashboard
- [ ] Audio recording playable from conversation detail
- [ ] Summary + sentiment auto-generated after call

---

## V2 Sprint 3 — WhatsApp Integration (Week 5–6)

### What gets built

**WhatsApp setup (via Twilio for V2, direct Meta in V3):**
- Twilio WhatsApp sandbox + production number flow
- Webhook endpoint for incoming WhatsApp messages
- Same conversation brain as voice (shared service)
- Interactive list messages for menu browsing
- Button replies for confirmations
- Image messages for menu photos
- Template message management UI

**Conversation handling:**
- Inbound message → look up customer by phone → if existing conversation in 24h window, continue; else start new
- Agent processes message using workspace menu/prompt → responds via WhatsApp
- Orders captured same as voice

**Outbound (template-only for V2):**
- Order confirmation template
- Delivery update template
- "Your order is ready" template
- Template approval workflow in dashboard

### Acceptance criteria

- [ ] Business connects WhatsApp number via Twilio
- [ ] Customer messages WhatsApp → conversation appears in dashboard
- [ ] AI handles full order via WhatsApp
- [ ] Outbound order confirmation sends via approved template
- [ ] 24-hour session window enforced

---

## V2 Sprint 4 — POS Integration (Toast first) (Week 7–8)

### What gets built

**Toast integration:**
- OAuth flow for Toast (business clicks Connect → redirects → comes back with tokens)
- Menu sync (Toast → VOAS knowledge base)
- Order push (VOAS → Toast when order placed)
- Two-way status sync (Toast order status → VOAS conversation)

**Dashboard:**
- Integrations page now has "Connect Toast" button
- Sync status indicator
- Manual sync trigger
- Mapping UI for any items that need manual mapping

**Architecture:**
- `POSProvider` interface in backend so adding Square/Clover is cleaner
- Background job system (Celery + Redis) for sync jobs

### Acceptance criteria

- [ ] Business can connect Toast account via OAuth
- [ ] Menu auto-imports from Toast
- [ ] AI-taken order lands in Toast as a real order
- [ ] Order status updates reflect in dashboard

---

## V2 Sprint 5 — Billing & Live Chat (Week 9–10)

### What gets built

**Stripe billing:**
- Stripe Customer + Subscription created on workspace creation
- Plan changes via dashboard (upgrade/downgrade)
- Usage-based billing for overages (minutes, messages)
- Failed payment handling (dunning, suspend after 14 days)
- Invoices visible in dashboard
- Webhook to handle subscription events

**Live chat support (V1.5 delivered here):**
- Supabase Realtime for chat channel per support session
- "Live chat" button in dashboard support → opens chat widget
- Admin presence indicator (online/offline)
- If no admin online: fallback to ticket creation
- Notifications for admins when chat starts
- Chat history saved as conversation

### Acceptance criteria

- [ ] Workspace on Starter plan billed $149/month via Stripe
- [ ] Plan upgrade reflected in workspace
- [ ] Failed payment triggers dunning email
- [ ] Live chat works between business and online admin
- [ ] Chat falls back to ticket if no admin online

---

# V3 — Scale & Expand (10–12 weeks)

**Goal:** From "real product" to "platform." Outbound, automation, analytics depth, public API, second vertical. This is what gets you from $10K MRR to $100K+ MRR.

**Success criteria:**
- Customers run outbound campaigns (win-back, review requests)
- Customers customize agent behavior without engineering help (flow builder)
- Dental/salon vertical fully supported with calendar bookings
- Third-party developers can build on VOAS API
- Analytics provides actionable business insights
- Owned voice stack reduces costs by 40%+

---

## V3 Sprint 1 — Outbound Campaigns (Week 1–2)

### What gets built

- Campaign builder UI (target audience, channel, schedule, template, goal)
- Audience segmentation (last visit > 30 days, total spend > $X, etc.)
- Campaign execution engine (background job)
- Outbound voice (Vapi outbound) + WhatsApp (template-only) + SMS
- Compliance: TCPA opt-in tracking, quiet hours, opt-out handling
- Campaign analytics: reach, response rate, conversion

---

## V3 Sprint 2 — Analytics Deep Dive (Week 3–4)

### What gets built

- Real analytics dashboard with charts (calls over time, by hour, by location, conversion funnel)
- Top intents (what customers ask for most)
- Sentiment trends
- Upsell performance
- Missed call recovery report
- Items requested but not on menu (gap analysis)
- Customer LTV cohort analysis
- Exportable reports (CSV, PDF)

---

## V3 Sprint 3 — No-Code Flow Builder (Week 5–7)

### What gets built

- Visual flow editor (React Flow or similar)
- Triggers (incoming call, keyword, customer attribute)
- Conditions (if/else, switch)
- Actions (send message, place order, escalate, tag customer, run integration)
- Test mode to simulate flows
- Version control on flows
- Template library (pre-built flows for common scenarios)

---

## V3 Sprint 4 — Public API & Developer Portal (Week 8–9)

### What gets built

- API keys per workspace (generate, rotate, revoke)
- Scoped permissions per key
- Rate limiting per key
- Webhook subscriptions UI
- Developer portal: docs (auto-generated + curated), API reference, SDKs (Node + Python), examples
- API changelog

---

## V3 Sprint 5 — Second Vertical (Dental/Salon) (Week 10–11)

### What gets built

- Vertical-aware onboarding wizard
- Service catalog (vs. menu) — schema generalization
- Calendar integration (Google Calendar, then Calendly)
- Appointment booking flow in agent
- Reminder/confirmation templates
- No-show win-back flow
- Vertical-specific dashboard widgets

---

## V3 Sprint 6 — Voice Stack Migration & Hardening (Week 12)

### What gets built

- Migrate from Vapi to owned stack: Deepgram (STT) + custom orchestration + ElevenLabs/Cartesia (TTS) + Twilio (SIP)
- A/B test old vs new for quality + latency + cost
- Direct Meta BSP partnership for WhatsApp (off Twilio)
- SOC 2 Type I preparation
- Penetration test
- Load testing (handle 1000 concurrent calls)

---

# Cross-Version Conventions

## Definition of Done (every sprint)

A sprint is only "done" when:
- [ ] All acceptance criteria met
- [ ] Code reviewed (or self-reviewed against CLAUDE.md)
- [ ] Tests pass (smoke tests at minimum)
- [ ] Deployed to staging
- [ ] Manually QA'd against acceptance criteria
- [ ] No P0/P1 bugs open
- [ ] Documentation updated
- [ ] CLAUDE.md updated if conventions/architecture changed

## Sprint Cadence

- **Sprint length:** 2 weeks
- **Sprint review:** end-of-sprint demo (founder + any team)
- **Retrospective:** what worked, what didn't, what to change

## Risk Management

**V1 risks:**
- Scope creep (mitigation: strict adherence to OUT-OF-SCOPE list)
- Supabase RLS misconfiguration (mitigation: test policies explicitly)
- Auth edge cases (mitigation: thorough manual testing of all flows)

**V2 risks:**
- Vapi/Twilio latency and reliability (mitigation: monitoring + fallback strategies)
- Toast API rate limits and quirks (mitigation: extensive integration tests, retry logic)
- WhatsApp template approval delays (mitigation: submit templates early in sprint)
- Stripe webhook handling (mitigation: idempotency, replay handling)

**V3 risks:**
- Vertical generalization breaks restaurant flows (mitigation: feature flag rollout)
- Voice stack migration quality regression (mitigation: A/B test, slow rollout)
- API abuse on public endpoints (mitigation: aggressive rate limits, abuse detection)

---

# Pricing & Resourcing (Reality Check)

**For one developer with AI assistance (you + Claude Code):**
- V1: 6–8 weeks realistic, 4 weeks if pushed hard
- V2: 8–10 weeks realistic
- V3: 10–12 weeks realistic

**For a team of 2 (full-stack + AI/voice specialist):**
- V1: 4 weeks
- V2: 6 weeks
- V3: 8 weeks

**For a team of 3–4 (proper engineering team):**
- V1: 2–3 weeks
- V2: 4 weeks
- V3: 6 weeks

You can ship V1 alone with Claude Code. V2 you really want a second pair of hands. V3 needs a small team.

---

**End of SPRINTS.md. When starting any sprint, re-read this file. Update it as the plan evolves.**
