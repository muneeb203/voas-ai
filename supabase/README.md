# Supabase

Migrations, RLS policies, and seed data for VOAS AI.

## Prerequisites

- Docker running
- Supabase CLI: https://supabase.com/docs/guides/cli

## Local stack

```bash
# Boot Postgres + Auth + Storage + Studio
supabase start

# Apply migrations + run seed
supabase db reset
```

After `supabase start`, the CLI prints:
- API URL: `http://localhost:54321`
- Studio: `http://localhost:54323`
- DB:     `postgresql://postgres:postgres@localhost:54322/postgres`
- `anon` key and `service_role` key

Paste these into `apps/web/.env.local` and `apps/api/.env`.

## Files

| Path | Purpose |
|---|---|
| `config.toml` | Local stack configuration |
| `migrations/00001_initial_schema.sql` | All V1 tables |
| `migrations/00002_rls_policies.sql` | RLS on every table |
| `seed.sql` | Dev fixtures (sample workspace, location, ticket) |

## Conventions

- **Never edit a committed migration.** Add a new one (`00003_*.sql`).
- **Every new table needs RLS** in the same PR.
- **Audit log is INSERT-only** — no UPDATE/DELETE in application code.
- Schema changes that affect frontend types: update `apps/web/lib/types.ts` in the same PR.

## Pushing to staging/production

```bash
supabase link --project-ref <ref>
supabase db push
```

## Creating an admin user

V1 admins are manually provisioned. After Sprint 5 ships, use:

```bash
# (script lands in Sprint 5)
python apps/api/scripts/create_admin.py --email you@convosol.com --name "Your Name"
```
