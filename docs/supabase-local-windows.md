# Supabase local on Windows — troubleshooting

## Commands must be separate

Run **one command per line**. These are wrong:

```powershell
supabase db resetdocker ps -a    # ❌ pasted together
```

Use:

```powershell
supabase db reset
docker ps -a
```

---

## PostgreSQL 15 vs 17

Error: `database files are incompatible ... 15 ... 17`

```powershell
cd E:\convosol\VOAS-AI\frontend
supabase stop --no-backup
docker volume rm supabase_db_voas-ai
supabase start
supabase db reset
```

`supabase/config.toml` should have `major_version = 17`.

---

## Storage (or DB) container unhealthy

### 1. Analytics warning on Windows

If you see:

`Analytics on Windows requires Docker daemon exposed on tcp://localhost:2375`

This repo sets `[analytics] enabled = false` in `config.toml` (recommended on Windows).

### 2. Full clean restart

```powershell
cd E:\convosol\VOAS-AI\frontend

supabase stop --no-backup

# Remove any leftover Supabase volumes for this project
docker volume ls -q | findstr supabase
# For each name listed, e.g.:
docker volume rm supabase_db_voas-ai
docker volume rm supabase_storage_voas-ai

# Optional: remove stopped Supabase containers
docker container prune -f

# Start (give it 2–3 minutes on first run)
supabase start --ignore-health-check
```

When status shows running, apply schema:

```powershell
supabase db reset
```

### 3. Docker Desktop resources

Settings → Resources: allocate at least **8 GB RAM** and **4 CPUs** if possible.

### 4. Still failing?

```powershell
supabase start --debug
```

Check storage logs:

```powershell
docker logs supabase_storage_voas-ai --tail 50
```

---

## Harmless NOTICE lines during `db reset`

```
policy "ticket_attachments_insert" ... does not exist, skipping
```

These are normal (`DROP POLICY IF EXISTS` before recreate). Not errors.

---

## Seed message: no auth users

```
No auth users exist yet — skipping workspace seed
```

Expected on a fresh DB. **Sign up once** in the app, then optionally:

```powershell
supabase db reset
```

(or run seed SQL manually after you have a user).

---

## After a successful `supabase start`

Copy from the CLI output into `apps/web/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Keep `supabase/.env` for Google OAuth secrets.
