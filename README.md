# VOAS AI

> Conversational front desk for businesses — voice, WhatsApp, and chat from one AI brain.

This is the VOAS AI monorepo. Start here, then read [`CLAUDE.md`](./CLAUDE.md) for the full product/architecture context and [`SPRINTS.md`](./SPRINTS.md) for the build plan.

---

## Repo structure

```
voas-ai/
├── apps/
│   ├── web/        Next.js 14 frontend (marketing + dashboard + admin)
│   └── api/        FastAPI backend
├── supabase/       Migrations, RLS policies, seed data
├── docs/           Architecture, deployment, onboarding
├── CLAUDE.md       Master product + architecture context
└── SPRINTS.md      Sprint-by-sprint build plan
```

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 — `npm install -g pnpm`
- **Python** 3.11 — `pyenv install 3.11` or download from python.org
- **Docker** (for local Supabase)
- **Supabase CLI** — [install guide](https://supabase.com/docs/guides/cli)

---

## First-time setup

```bash
# 1. Install JS dependencies
pnpm install

# 2. Install Python dependencies (in apps/api)
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

# 3. Copy env files and fill in values
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# 4. Start local Supabase (Postgres + Auth + Storage)
pnpm supabase:start
# Outputs anon key, service role key, URL — paste into .env files

# 5. Apply migrations and seed
pnpm supabase:reset
```

---

## Daily development

```bash
# Terminal 1: frontend (http://localhost:3001)
pnpm dev

# Terminal 2: backend (http://localhost:8000)
pnpm dev:api

# Terminal 3: Supabase studio (http://localhost:54323)
# Already running from pnpm supabase:start
```

---

## Common scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the Next.js frontend on :3000 |
| `pnpm dev:api` | Run the FastAPI backend on :8000 |
| `pnpm build` | Production build of the frontend |
| `pnpm lint` | ESLint over apps/web |
| `pnpm typecheck` | TypeScript check over apps/web |
| `pnpm format` | Prettier-format the whole repo |
| `pnpm supabase:start` | Boot local Supabase stack |
| `pnpm supabase:reset` | Drop and re-apply all migrations + seed |

---

## Where to read next

- **New to the project?** → [`CLAUDE.md`](./CLAUDE.md) (full context, ~30 min read)
- **Picking up a sprint?** → [`SPRINTS.md`](./SPRINTS.md)
- **Deploying?** → [`docs/deployment.md`](./docs/deployment.md)
- **API reference?** → run `pnpm dev:api` then open http://localhost:8000/docs

---

## License

Proprietary — © Convosol 2026. All rights reserved.
