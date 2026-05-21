# Onboarding — new developers

Welcome. Plan for 2–3 hours to get from zero to running locally.

## 1. Read these in order

1. [`../CLAUDE.md`](../CLAUDE.md) — full product context (~30 min)
2. [`../SPRINTS.md`](../SPRINTS.md) — what we're building when
3. [`./architecture.md`](./architecture.md) — system shape

## 2. Install prerequisites

| Tool | Version | How |
|---|---|---|
| Node.js | 20+ | https://nodejs.org or `nvm install 20` |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.11 | https://python.org or `pyenv install 3.11` |
| Docker | latest | https://docker.com |
| Supabase CLI | latest | https://supabase.com/docs/guides/cli |
| Git | 2.40+ | https://git-scm.com |

## 3. Local setup

```bash
# Frontend deps
pnpm install

# Backend deps
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate
pip install -e ".[dev]"
cd ../..

# Env files
cp apps/web/.env.local.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Local Supabase
supabase start
# Copy the printed anon key, service_role key, URL into both .env files

# Schema + seed
supabase db reset
```

## 4. Daily workflow

```bash
# Terminal 1
pnpm dev               # http://localhost:3001

# Terminal 2
cd apps/api && uvicorn app.main:app --reload  # http://localhost:8000
```

## 5. Before opening a PR

- [ ] `pnpm lint` and `pnpm typecheck` pass
- [ ] `cd apps/api && ruff check . && pytest -q` pass
- [ ] No `.env*` committed
- [ ] If you changed schema, you added a new migration + RLS policy
- [ ] PR description fills in the template

## 6. Things that look weird but are intentional

- `apps/api` isn't in `pnpm-workspace.yaml` — it's a Python project, pnpm doesn't manage it
- Audit log has no UPDATE/DELETE policies — by design, see CLAUDE.md §8 rule 11
- `admin_users` RLS is `using (false)` — only service role touches it
- Working directory is named `frontend` but the repo is a full monorepo — historical naming
