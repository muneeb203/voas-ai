# CLAUDE.md — VOAS AI Master Context

> This file is the single source of truth for building VOAS AI. Read it completely before writing any code. When in doubt, follow this document over your own assumptions. If something here conflicts with a user request, ask before proceeding.

---

## 1. Product Overview

### 1.1 What VOAS AI Is

VOAS AI is a **conversational front desk for businesses**. It answers every phone call, WhatsApp message, and web chat with one AI brain that takes orders, books appointments, handles complaints, and follows up with customers.

It plugs into the tools the business already uses (Toast, Square, Stripe, WhatsApp Business), and gives owners a dashboard showing every conversation, what customers actually want, and where money is being left on the table.

**Starting vertical:** Restaurants (highest call volume, clearest ROI).
**Expansion verticals:** Dental, salons, auto repair, and any local service business with a phone number and calendar.

### 1.2 Who It's For

**SMB tier (self-serve):** 1–10 location restaurants. Owner-operated. Signs up online, connects POS via OAuth, goes live in under an hour. Pricing $149–$499/month per location.

**Mid-market / Enterprise tier (sales-assisted):** 10+ locations, chains, franchises. Talks to sales, gets a pilot, custom integrations. $1K–$10K+/month.

The product is the same. The sales motion differs.

### 1.3 The Core Wedge

Most enterprise voice AI is built like an FAQ pattern-matcher. VOAS is built around one constraint: **the agent should sound like someone who is paying attention.** Cross-channel context, emotional awareness, clean human handoff, and one unified conversation across voice + WhatsApp + chat.

### 1.4 What Makes VOAS Different from Vapi / Kea / ConverseNow

- **Omnichannel by default** — voice, WhatsApp, SMS, web chat all share one brain
- **Beyond order-taking** — handles complaints, status, refunds, upsells, win-back
- **Intelligence dashboard** — every conversation transcribed, tagged, analyzed
- **Vertical-flexible** — restaurant-first, but architected for dental/salons/auto from day one

---

## 2. Tech Stack (LOCKED — do not deviate without explicit approval)

### 2.1 Stack Decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend | **Next.js 14 (App Router) + TypeScript** | Best DX, SSR for marketing SEO, ecosystem |
| UI | **Tailwind CSS + shadcn/ui** | Fast, clean, professional, customizable |
| Backend | **Python 3.11 + FastAPI** | Best for AI/voice workloads, async, typed |
| Database | **Supabase (Postgres)** | Managed Postgres + auth + storage + realtime |
| Auth | **Supabase Auth** | Email/password, Google OAuth, JWT-based |
| Realtime | **Supabase Realtime** | For live chat, live conversations dashboard |
| Storage | **Supabase Storage** | Audio recordings, logos, attachments |
| Frontend hosting | **Vercel** | Native Next.js, free tier sufficient for MVP |
| Backend hosting | **Railway** (or Render) | Easy FastAPI deploys, good free/cheap tier |
| Background jobs | **Celery + Redis** (Sprint 2+) | For async tasks (transcription, analytics) |
| Monitoring | **Sentry** (frontend + backend) | Error tracking |
| Analytics | **PostHog** | Product analytics, session replay |
| Email | **Resend** | Transactional email (verification, notifications) |

### 2.2 Package Versions (LOCK THESE)

**Frontend (`apps/web/package.json`):**
- next: `^14.2.0`
- react: `^18.3.0`
- typescript: `^5.5.0`
- tailwindcss: `^3.4.0`
- @supabase/supabase-js: `^2.45.0`
- @supabase/ssr: `^0.5.0`
- zod: `^3.23.0`
- react-hook-form: `^7.52.0`
- @hookform/resolvers: `^3.9.0`
- lucide-react: `^0.400.0`
- date-fns: `^3.6.0`
- shadcn/ui components (installed individually via CLI)

**Backend (`apps/api/pyproject.toml`):**
- python: `^3.11`
- fastapi: `^0.115.0`
- uvicorn: `^0.30.0`
- pydantic: `^2.9.0`
- pydantic-settings: `^2.5.0`
- supabase: `^2.7.0`
- python-jose: `^3.3.0` (for JWT verification)
- httpx: `^0.27.0`
- python-dotenv: `^1.0.0`
- pytest: `^8.3.0` (dev)
- ruff: `^0.6.0` (dev)

### 2.3 Repo Structure

```
voas-ai/
├── apps/
│   ├── web/                          # Next.js frontend (marketing + dashboard + admin)
│   │   ├── app/
│   │   │   ├── (marketing)/          # Public marketing routes
│   │   │   │   ├── page.tsx          # Homepage
│   │   │   │   ├── product/
│   │   │   │   ├── pricing/
│   │   │   │   ├── contact/
│   │   │   │   └── layout.tsx
│   │   │   ├── (auth)/               # Login/signup routes
│   │   │   │   ├── login/
│   │   │   │   ├── signup/
│   │   │   │   ├── verify-email/
│   │   │   │   └── layout.tsx
│   │   │   ├── (dashboard)/          # Business-facing app
│   │   │   │   ├── dashboard/
│   │   │   │   ├── conversations/
│   │   │   │   ├── orders/
│   │   │   │   ├── knowledge-base/
│   │   │   │   ├── integrations/
│   │   │   │   ├── analytics/
│   │   │   │   ├── team/
│   │   │   │   ├── settings/
│   │   │   │   ├── support/
│   │   │   │   └── layout.tsx
│   │   │   ├── admin/                # VOAS team admin panel
│   │   │   │   ├── login/
│   │   │   │   ├── workspaces/
│   │   │   │   ├── users/
│   │   │   │   ├── support/
│   │   │   │   ├── audit-log/
│   │   │   │   ├── settings/
│   │   │   │   └── layout.tsx
│   │   │   ├── api/                  # Next.js API routes (light — most API is FastAPI)
│   │   │   │   └── auth/
│   │   │   ├── layout.tsx            # Root layout
│   │   │   ├── globals.css
│   │   │   └── not-found.tsx
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui primitives
│   │   │   ├── marketing/            # Marketing-only components
│   │   │   ├── dashboard/            # Dashboard components
│   │   │   ├── admin/                # Admin-only components
│   │   │   └── shared/               # Used in both
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts         # Browser client
│   │   │   │   ├── server.ts         # Server client
│   │   │   │   └── middleware.ts     # Auth middleware
│   │   │   ├── api.ts                # Wrapper for FastAPI calls
│   │   │   ├── utils.ts
│   │   │   └── types.ts              # Shared TS types
│   │   ├── middleware.ts             # Next middleware (auth gating)
│   │   ├── public/
│   │   ├── .env.local.example
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                          # FastAPI backend
│       ├── app/
│       │   ├── main.py               # FastAPI app entry
│       │   ├── config.py             # Settings (pydantic-settings)
│       │   ├── deps.py               # Dependency injection (auth, db)
│       │   ├── core/
│       │   │   ├── security.py       # JWT verification
│       │   │   ├── supabase.py       # Supabase client
│       │   │   └── exceptions.py     # Custom exceptions
│       │   ├── routers/
│       │   │   ├── health.py
│       │   │   ├── workspaces.py
│       │   │   ├── locations.py
│       │   │   ├── members.py
│       │   │   ├── tickets.py
│       │   │   ├── admin.py          # Admin-only endpoints
│       │   │   └── contact.py        # Marketing contact form
│       │   ├── models/               # Pydantic models (request/response)
│       │   │   ├── workspace.py
│       │   │   ├── ticket.py
│       │   │   └── ...
│       │   ├── services/             # Business logic
│       │   │   ├── workspace_service.py
│       │   │   ├── ticket_service.py
│       │   │   └── ...
│       │   └── utils/
│       ├── tests/
│       ├── .env.example
│       ├── pyproject.toml
│       ├── Dockerfile
│       └── README.md
│
├── supabase/
│   ├── migrations/                   # SQL migrations, ordered
│   │   ├── 00001_initial_schema.sql
│   │   ├── 00002_rls_policies.sql
│   │   └── ...
│   ├── seed.sql                      # Dev seed data
│   └── config.toml
│
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   ├── deployment.md
│   └── onboarding.md                 # For new devs
│
├── .github/
│   └── workflows/
│       ├── web-ci.yml
│       └── api-ci.yml
│
├── CLAUDE.md                         # This file
├── SPRINTS.md                        # Sprint plan
├── README.md
├── .gitignore
├── pnpm-workspace.yaml
└── package.json                      # Root, scripts only
```

---

## 3. Architecture

### 3.1 High-Level Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Marketing Site │     │ Business Dash   │     │  Admin Panel    │
│   (Next.js)     │     │   (Next.js)     │     │   (Next.js)     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐              │
         │              │ Supabase Auth   │              │
         │              │   (JWT issuer)  │              │
         │              └────────┬────────┘              │
         │                       │                       │
         └───────────┬───────────┴───────────┬───────────┘
                     │                       │
                     ▼                       ▼
            ┌─────────────────┐     ┌─────────────────┐
            │ FastAPI Backend │◄────┤ Supabase Postgres│
            │   (Railway)     │     │  (managed DB +   │
            │                 │     │   Realtime + RLS)│
            └────────┬────────┘     └─────────────────┘
                     │
                     ├──► Resend (email)
                     ├──► Sentry (errors)
                     └──► (V2+) Vapi, WhatsApp, Toast, Stripe
```

### 3.2 Auth Flow

1. **Business user signs up** on `/signup` → Supabase Auth creates user → email verification → on first login, FastAPI creates workspace + makes them owner.
2. **Business user logs in** → Supabase issues JWT → frontend stores in cookie (via `@supabase/ssr`) → all API calls include JWT → FastAPI verifies JWT, extracts `user_id`, looks up workspace membership.
3. **Admin user logs in** on `/admin/login` → separate flow → checked against `admin_users` table → requires TOTP 2FA → issues admin JWT with `is_admin: true` claim.
4. **Impersonation:** admin can call `POST /admin/impersonate/{workspace_id}` → returns scoped token → admin sees that workspace's data → every read/write logged to `audit_logs`.

### 3.3 Multi-Tenancy Model

- **Workspace** = the top-level tenant. Every business has one workspace.
- **Workspace members** = users belonging to that workspace, with a role (`owner`, `manager`, `staff`).
- **Locations** = physical stores under a workspace (chains have many; SMBs have one).
- **All business data** (conversations, orders, tickets, etc.) has a `workspace_id` foreign key.
- **Row-Level Security (RLS)** policies in Postgres enforce that users only see their workspace's data. FastAPI also enforces this in code (defense in depth).
- **Admins** bypass RLS via a service-role key, but every admin action is logged.

### 3.4 Frontend Routing & Auth Gating

Use Next.js middleware (`middleware.ts`):

- Public routes (`/`, `/product`, `/pricing`, `/contact`, `/login`, `/signup`): no auth required.
- Dashboard routes (`/dashboard/*`, `/conversations/*`, etc.): require valid business user JWT.
- Admin routes (`/admin/*` except `/admin/login`): require valid admin JWT with `is_admin: true`.
- Redirect unauthenticated users on protected routes to `/login` (business) or `/admin/login` (admin).

### 3.5 API Conventions

**Base URL:** `https://api.voas.ai` (production), `http://localhost:8000` (dev).

**All endpoints prefixed `/v1/`.**

**Auth:** Bearer JWT in `Authorization` header.

**Response shape (success):**
```json
{ "data": { ... } }
```

**Response shape (error):**
```json
{ "error": { "code": "WORKSPACE_NOT_FOUND", "message": "..." } }
```

**Pagination (when needed):**
```
GET /v1/conversations?limit=50&cursor=<opaque>
→ { "data": [...], "next_cursor": "..." }
```

**Idempotency:** mutating endpoints accept optional `Idempotency-Key` header.

---

## 4. Database Schema (V1)

> All tables include `id uuid primary key default gen_random_uuid()`, `created_at timestamptz default now()`, and most include `updated_at timestamptz default now()` with a trigger to auto-update.

### 4.1 Core Tables

```sql
-- Workspaces (the tenant)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,                    -- URL-safe identifier
  plan text not null default 'starter',         -- starter, growth, scale, enterprise
  vertical text not null default 'restaurant',  -- restaurant, dental, salon, etc.
  status text not null default 'active',        -- active, suspended, deleted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspace members (users in a workspace)
create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id, user_id)
);

-- Locations (physical stores)
create table locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  postal_code text,
  country text default 'US',
  phone text,
  timezone text default 'America/New_York',
  hours jsonb,                                  -- {mon: {open: '09:00', close: '22:00'}, ...}
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin users (VOAS team)
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'super_admin')),
  totp_secret text,                             -- encrypted, for 2FA
  totp_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Support tickets
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  assigned_admin_id uuid references admin_users(id),
  subject text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category text,                                -- billing, integration, bug, feature_request, other
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Ticket messages (threaded conversation)
create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin', 'system')),
  sender_id uuid not null,                      -- user_id or admin_user_id
  body text not null,
  attachments jsonb,                            -- [{url, filename, size}]
  is_internal_note boolean not null default false,  -- admin-only notes
  created_at timestamptz not null default now()
);

-- Live chat sessions (V1.5 — schema ready, feature deferred)
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  started_by uuid not null references auth.users(id),
  claimed_by_admin_id uuid references admin_users(id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  fallback_ticket_id uuid references support_tickets(id)
);

create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin', 'system')),
  sender_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- Audit log (every meaningful action)
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'admin', 'system')),
  actor_id uuid not null,
  workspace_id uuid references workspaces(id),  -- nullable for system-level actions
  action text not null,                         -- e.g., 'workspace.created', 'admin.impersonate'
  resource_type text,
  resource_id uuid,
  metadata jsonb,                               -- arbitrary context
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

-- Marketing contact form submissions
create table contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  phone text,
  message text not null,
  source text,                                  -- which page form was on
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now()
);

-- Invitations (pending team invites)
create table invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'staff')),
  invited_by uuid not null references auth.users(id),
  token text not null unique,                   -- random token for invite link
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
```

### 4.2 Indexes

```sql
create index idx_workspace_members_workspace on workspace_members(workspace_id);
create index idx_workspace_members_user on workspace_members(user_id);
create index idx_locations_workspace on locations(workspace_id);
create index idx_support_tickets_workspace on support_tickets(workspace_id);
create index idx_support_tickets_status on support_tickets(status);
create index idx_support_messages_ticket on support_messages(ticket_id);
create index idx_audit_logs_workspace on audit_logs(workspace_id);
create index idx_audit_logs_actor on audit_logs(actor_type, actor_id);
create index idx_audit_logs_created on audit_logs(created_at desc);
```

### 4.3 RLS Policies (CRITICAL — security boundary)

**Enable RLS on every table.** Then add policies:

```sql
-- Workspaces: members can read their own workspace
alter table workspaces enable row level security;

create policy "members can read own workspace" on workspaces for select
  using (id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "owners can update own workspace" on workspaces for update
  using (id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

-- Workspace members: visible to members of same workspace
alter table workspace_members enable row level security;

create policy "members can read workspace members" on workspace_members for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

-- Locations, tickets, etc. follow same pattern: scoped to workspace_id

-- Admin tables: only readable by admins (using service role; no RLS bypass for regular users)
alter table admin_users enable row level security;
create policy "admins only" on admin_users for all using (false);  -- locked down; service role bypasses
```

**FastAPI uses the service role key** for trusted operations and enforces workspace scoping in application code. Frontend direct Supabase queries use the user's JWT and rely on RLS.

---

## 5. UI/UX Design System

### 5.1 Visual Identity

- **Brand name:** VOAS AI
- **Logo:** placeholder — text logo "VOAS" in semibold, with "AI" in lighter weight. Replace with real logo when available.
- **Primary color:** `#0A2540` (deep navy — trustworthy, professional)
- **Accent color:** `#00C2A8` (teal — modern, conversational)
- **Neutral palette:** Tailwind slate (50–900)
- **Success:** `#10B981`, **Warning:** `#F59E0B`, **Error:** `#EF4444`
- **Typography:** Inter (sans), JetBrains Mono (code)
- **Border radius:** `rounded-lg` (8px) default
- **Shadow style:** subtle, modern (`shadow-sm` for cards, `shadow-md` for modals)

### 5.2 Layout Conventions

**Marketing:**
- Max width container: `max-w-7xl mx-auto px-6`
- Top nav: logo left, links center, CTA right
- Footer: 4 columns (Product, Company, Resources, Legal)

**Dashboard:**
- Sidebar: left, 240px wide, collapsible to icons-only at <1024px
- Top bar: workspace switcher (left), notifications + user menu (right)
- Main content: `max-w-7xl px-6 py-8`
- Empty states: friendly illustration + clear CTA

**Admin:**
- Same shell as dashboard but distinct color accent (subtle red/orange tint) so admins always know they're in the admin panel
- Banner at top when impersonating: "Viewing as [Workspace Name] — [Exit Impersonation]"

### 5.3 Component Library (shadcn/ui)

Install these components in Sprint 1:
- `button`, `input`, `label`, `textarea`, `select`, `checkbox`, `switch`
- `card`, `dialog`, `sheet`, `dropdown-menu`, `popover`
- `table`, `tabs`, `badge`, `avatar`, `separator`
- `toast` (sonner), `tooltip`, `skeleton`
- `form` (react-hook-form integration)

### 5.4 Accessibility

- All interactive elements keyboard-navigable
- Focus rings visible
- Color contrast WCAG AA minimum
- Forms have associated labels
- Screen reader friendly (aria-* attributes where needed)

---

## 6. Conventions & Code Standards

### 6.1 General Rules

1. **TypeScript strict mode.** No `any` unless absolutely necessary and commented.
2. **No comments unless asked.** Code should be self-documenting. Comments only for non-obvious *why*.
3. **One concern per file.** Components, hooks, utilities — separated.
4. **Server components by default** in Next.js App Router. Use `'use client'` only when needed (interactivity, hooks).
5. **No magic strings.** Constants in `lib/constants.ts`.
6. **No inline styles.** Tailwind classes only.
7. **Validate all inputs.** Frontend with Zod + react-hook-form. Backend with Pydantic.

### 6.2 Frontend Conventions

- **File naming:** `kebab-case.tsx` for components, `camelCase.ts` for utilities
- **Component naming:** `PascalCase`
- **Hook naming:** `useThing`
- **Server actions:** in `app/actions/` folder, suffix `-action.ts`
- **Imports order:** React → external → internal (`@/`) → relative → types
- **No default exports** except for Next.js page/layout files

### 6.3 Backend Conventions

- **File naming:** `snake_case.py`
- **Class naming:** `PascalCase`
- **Function naming:** `snake_case`
- **All endpoints async** (`async def`)
- **Dependency injection** for auth and DB access (FastAPI `Depends`)
- **Pydantic models** for every request/response — no raw dicts
- **Service layer** for business logic — routers stay thin
- **Type hints everywhere**

### 6.4 Git Conventions

- **Branch naming:** `feat/short-description`, `fix/short-description`, `chore/...`
- **Commit format:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- **PR template** in `.github/pull_request_template.md`

---

## 7. Environment Variables

### 7.1 Frontend (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
RESEND_API_KEY=                     # server-only
```

### 7.2 Backend (`apps/api/.env`)

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
DATABASE_URL=                       # direct Postgres connection
CORS_ORIGINS=http://localhost:3000,https://voas.ai
SENTRY_DSN=
RESEND_API_KEY=
ENVIRONMENT=development             # development | staging | production
LOG_LEVEL=INFO
```

### 7.3 `.env.example` files

Always commit `.env.example` with placeholders, never commit actual `.env`.

---

## 8. Security Rules (NON-NEGOTIABLE)

1. **Never commit secrets.** `.env` in `.gitignore` always.
2. **All passwords hashed** by Supabase Auth (never store plaintext).
3. **Admin 2FA required** before going to production. Stub OK in dev.
4. **RLS enabled on every table.** No exceptions.
5. **Service role key only used server-side**, never in frontend bundles.
6. **CORS strictly configured** — only allow known origins.
7. **Rate limiting on API** — global (1000 req/hour per IP) + per-user (100 req/min on writes).
8. **SQL injection: impossible** — only use parameterized queries via Supabase client.
9. **XSS: prevented** — React escapes by default, never use `dangerouslySetInnerHTML` without sanitization (use DOMPurify if absolutely needed).
10. **CSRF: handled** by Supabase auth cookies (SameSite=Lax).
11. **Audit log writes are immutable** — no UPDATE/DELETE policies on `audit_logs`.
12. **Impersonation is logged** every single time, with admin_id, target_workspace_id, start/end timestamps.
13. **Password reset flows** use Supabase Auth's built-in flow — don't reimplement.
14. **Session timeout:** business users 30 days, admins 8 hours.

---

## 9. What's IN Scope for V1 / What's OUT

### 9.1 IN scope for V1 (this is the MVP)

**Marketing site:**
- Homepage with hero, value prop, how-it-works, CTA
- Product page
- Pricing page (3 tiers + enterprise)
- Contact page with form
- Login / Signup pages

**Business dashboard:**
- Auth (signup, login, email verification, password reset, Google OAuth)
- Workspace creation on first login
- Sidebar navigation with all sections (some as placeholders)
- **Functional pages:**
  - Settings: workspace name, plan info (read-only), basic profile
  - Locations: CRUD (add/edit/delete locations, set hours)
  - Team: invite members, manage roles, remove members
  - Support: create ticket, view tickets, reply to tickets
- **Placeholder pages** (visible in sidebar, but "coming soon" content):
  - Conversations, Orders, Knowledge Base, Integrations, Analytics

**Admin panel:**
- Separate login at `/admin/login` (manually provisioned admin accounts)
- Workspaces list with search, click into workspace detail
- Workspace detail: see members, locations, tickets, audit log
- Impersonation (admin can view dashboard as that workspace)
- Users list across all workspaces
- Support inbox: all tickets across workspaces, assign, reply, resolve
- Audit log viewer with filters
- Contact form submissions inbox

**Support system:**
- Tickets only in V1 (no live chat)
- Email notifications on ticket events
- Internal admin notes on tickets

**Cross-cutting:**
- Error tracking (Sentry)
- Product analytics (PostHog)
- Transactional email (Resend)
- Responsive design (mobile-friendly dashboard, fully responsive marketing)

### 9.2 OUT of scope for V1 (explicit non-goals)

- ❌ Real voice integration (Vapi) — V2
- ❌ Real WhatsApp integration — V2
- ❌ Real POS integration (Toast, Square) — V2
- ❌ Live chat support (Supabase Realtime) — V1.5 or V2
- ❌ Billing / Stripe — V2
- ❌ Conversations page content (real conversations) — V2
- ❌ Knowledge base editor — V2
- ❌ Analytics charts with real data — V2
- ❌ Outbound calling / messaging — V3
- ❌ No-code flow builder — V3
- ❌ Public API for customers — V3
- ❌ Multi-language support — V3
- ❌ Mobile apps — Not planned

> **If asked to add anything from the OUT list during V1, push back and confirm explicitly. Scope creep kills MVPs.**

---

## 10. Specific Build Instructions for Claude Code

### 10.1 Order of Operations (V1)

Build in this order. Do not start the next step until the previous is functional and tested:

1. **Monorepo scaffold** — root `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`, both app folders with starter configs
2. **Supabase project setup** — local CLI, initial migration with full schema, RLS policies, seed data for dev
3. **Frontend foundation** — Next.js app, Tailwind, shadcn/ui setup, base layout, theme
4. **Backend foundation** — FastAPI app, config, Supabase client, JWT verification, health endpoint, CORS
5. **Auth flow** — Supabase Auth integration on frontend, signup/login pages, email verification, password reset, Google OAuth, middleware-based route gating
6. **Workspace bootstrap** — on first login, create workspace + owner membership; workspace switcher in topbar
7. **Marketing site** — homepage, product, pricing, contact (with form posting to backend)
8. **Dashboard shell** — sidebar, topbar, all placeholder pages, layout
9. **Settings page** — workspace name edit, profile edit
10. **Locations CRUD** — list, add, edit, delete, with form validation
11. **Team management** — invite via email, accept invite flow, role management, remove
12. **Support tickets** — create, list, view, reply, resolve (user side)
13. **Admin login** — separate auth, manual provisioning script for first admin
14. **Admin: Workspaces list + detail** — search, view, click into workspace
15. **Admin: Impersonation** — view-as flow, banner, exit, audit logging
16. **Admin: Users list** — all users across workspaces
17. **Admin: Support inbox** — all tickets, assign, reply, internal notes, resolve
18. **Admin: Audit log** — paginated, filterable
19. **Admin: Contact submissions** — list, mark contacted
20. **Polish pass** — error states, loading states, empty states, toast notifications, form validation, accessibility check
21. **Deploy** — Vercel (web), Railway (api), Supabase (already managed). Set up envs, smoke test.

### 10.2 How to Handle Ambiguity

**If a requirement is unclear, ASK. Do not assume.** Better to ask one question than to build 4 hours of wrong code.

When asking:
- State your understanding
- State the ambiguity
- Propose 2–3 options with tradeoffs
- Wait for the answer

### 10.3 How to Handle Errors and Edge Cases

- **Empty states:** every list view must have a friendly empty state with a CTA
- **Loading states:** skeletons for lists, spinners for actions
- **Error states:** user-friendly messages, never raw stack traces in UI
- **Form validation:** real-time on blur, inline error messages, submit button disabled when invalid
- **Network errors:** toast notification with retry option
- **404s:** custom not-found page with link home
- **403s:** "You don't have access to this" with link back to dashboard

### 10.4 Testing Expectations for V1

V1 is MVP — comprehensive test suites are overkill, but:

- **Backend:** smoke tests for each endpoint (happy path + 1 error case). Use pytest + httpx.
- **Frontend:** no unit tests required for V1, but every page must be manually testable.
- **E2E:** one Playwright test for the critical path (signup → create location → invite member → log out) — add in late V1.

### 10.5 Deployment Notes

**Vercel (frontend):**
- Connect GitHub repo
- Root directory: `apps/web`
- Build command: `pnpm build`
- Set all `NEXT_PUBLIC_*` and server env vars in Vercel dashboard

**Railway (backend):**
- Connect GitHub repo
- Root directory: `apps/api`
- Build: Dockerfile-based
- Set env vars in Railway dashboard
- Expose port 8000

**Supabase:**
- Create project at supabase.com
- Run migrations via Supabase CLI (`supabase db push`)
- Configure auth providers (email, Google) in dashboard
- Set redirect URLs (localhost + production)

### 10.6 What Claude Code MUST NOT Do

- ❌ Do not introduce new dependencies without asking
- ❌ Do not change the tech stack
- ❌ Do not skip RLS policies
- ❌ Do not commit secrets or `.env` files
- ❌ Do not build anything from the "OUT of scope" list
- ❌ Do not use `any` in TypeScript without explicit justification
- ❌ Do not use raw SQL strings (parameterized only)
- ❌ Do not bypass the service layer in the backend (routers stay thin)
- ❌ Do not assume — ask when unclear
- ❌ Do not write tests for V2/V3 features in V1

---

## 11. Project Owner & Contacts

- **Founder / Product:** M.Hadi (Convosol, Islamabad, Pakistan)
- **Co-Founder:** Muneeb Qureshi
- **Company:** Convosol → ConvoSol
- **Product domain:** voas.ai (TBD purchase)
- **Repo:** TBD (GitHub)

---

## 12. References

- Sprint plan: `SPRINTS.md`
- Architecture deep-dive: `docs/architecture.md`
- API reference: auto-generated by FastAPI at `/docs`
- Deployment guide: `docs/deployment.md`
- Post-V1 hardening backlog: `POST_V1.md`

---

## 13. V1 status

V1 Sprints 1–6 complete. Marketing site, auth + onboarding, dashboard (settings / locations / team), support tickets (with attachments on replies), admin panel (workspaces / users / inbox / audit / contact submissions / impersonation), observability scaffolding (Sentry + PostHog, no-op without env vars), and a comprehensive deploy guide are all shipped.

Production hardening items deferred to `POST_V1.md` — most importantly: real TOTP 2FA for admins, real Resend email integration, and database-level audit-log immutability. These should land before serious customer onboarding in V2.

---

**End of CLAUDE.md. When you (Claude Code) start a session, re-read this file. When the project changes, update this file first.**
