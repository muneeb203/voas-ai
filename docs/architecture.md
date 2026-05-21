# Architecture

> Deep-dive on how VOAS AI fits together. For the product context, read [`../CLAUDE.md`](../CLAUDE.md).

## Big picture

```
Browser ──► Next.js (Vercel) ──► FastAPI (Railway) ──► Supabase Postgres
                │                       │
                └──► Supabase Auth ◄────┘
                            │
                            ▼
                        JWT cookie
```

- **Next.js** handles all UI (marketing + dashboard + admin) and proxies most API calls to FastAPI. A few light routes live under `app/api/` (e.g. auth callbacks).
- **FastAPI** is the system of record for business logic. It uses the Supabase service-role key for trusted writes and enforces workspace scoping in code as defense-in-depth alongside RLS.
- **Supabase** is Postgres + Auth + Storage + Realtime. RLS is enabled on every table.

## Multi-tenancy

`workspaces` is the tenant. Every business has exactly one. Every business-owned row carries `workspace_id`. Two layers of enforcement:

1. **RLS** in Postgres — the frontend's anon/authenticated key can only see rows for the user's workspaces.
2. **Application code** in FastAPI — every endpoint validates that the JWT's user belongs to the workspace they're acting on, even though the service role bypasses RLS.

## Auth

- **Business users**: Supabase Auth (email/password + Google OAuth). JWT in HttpOnly cookie via `@supabase/ssr`.
- **Admins**: same Supabase Auth, but tagged with `app_metadata.is_admin = true`. Separate login at `/admin/login`. TOTP 2FA required in production. Sessions are 8 hours (vs. 30 days for business users).

JWT verification in FastAPI: `app/core/security.py` decodes with the Supabase JWT secret using HS256.

## Conventions

See [`../CLAUDE.md`](../CLAUDE.md) §3.5 for full API conventions. TL;DR:

- All endpoints under `/v1/`
- Success: `{"data": ...}`. Error: `{"error": {"code", "message"}}`
- Mutating endpoints accept optional `Idempotency-Key` header
- Pagination via opaque cursor

## Where things live

| Concern | Where |
|---|---|
| UI components | `apps/web/components/` |
| Pages | `apps/web/app/` |
| Frontend Supabase clients | `apps/web/lib/supabase/` |
| API routes | `apps/api/app/routers/` |
| Business logic | `apps/api/app/services/` |
| Pydantic models | `apps/api/app/models/` |
| Schema + RLS | `supabase/migrations/` |
