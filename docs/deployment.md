# Deployment

End-to-end guide for taking VOAS AI V1 from local dev to live at `voas.ai`. Expect ~3 hours total the first time. Each section is independent — you can do them in parallel.

| Component | Hosting | Notes |
|---|---|---|
| `apps/web` | **Vercel** | Native Next.js, auto-deploys on push to main |
| `apps/api` | **Railway** | Builds the Dockerfile in `apps/api/` |
| Database + Auth + Storage | **Supabase Cloud** | Separate project from your local stack |
| Domain + SSL | Cloudflare / Namecheap / Google Domains | DNS lives wherever you registered |

---

## Pre-flight checklist

Before you start, sign up for (free tiers are fine for V1 launch):

- [ ] Supabase Cloud account → [supabase.com](https://supabase.com)
- [ ] Vercel account → [vercel.com](https://vercel.com)
- [ ] Railway account → [railway.app](https://railway.app)
- [ ] Sentry account (optional but recommended) → [sentry.io](https://sentry.io)
- [ ] PostHog account (optional) → [posthog.com](https://posthog.com)
- [ ] Resend account → [resend.com](https://resend.com) — required for real email
- [ ] Domain registered (e.g. `voas.ai`)
- [ ] Code pushed to GitHub on a `main` branch

---

## 1. Supabase Cloud project (15 min)

1. **Create the project** at supabase.com/dashboard → "New project". Pick a region close to your users (us-east-1 for North America). Save the database password somewhere safe.

2. **Apply migrations** from your local repo:

   ```powershell
   supabase link --project-ref <your-ref>
   supabase db push
   ```

   You'll see `00001_initial_schema.sql`, `00002_rls_policies.sql`, and `00003_ticket_attachments_storage.sql` apply in order.

3. **Configure auth** (Supabase dashboard → Authentication → URL Configuration):
   - **Site URL**: `https://voas.ai`
   - **Redirect URLs**: `https://voas.ai/**` (the `**` is important for auth callbacks)
   - Email provider: stays on default until you wire Resend (next section). For now, Supabase's default sender works for testing.

4. **Capture credentials** (Settings → API):
   - Project URL → goes into `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` (**never** prefix with `NEXT_PUBLIC_`)
   - JWT Settings → JWT Secret → `SUPABASE_JWT_SECRET`

5. **Optional: Google OAuth** (deferred in V1; ignore unless you decide to enable):
   - Authentication → Providers → Google → toggle on
   - Set client ID + secret from a Google Cloud OAuth client
   - Redirect URI: `https://<your-ref>.supabase.co/auth/v1/callback`

---

## 2. Resend (5 min)

1. Sign up, verify your sending domain (you'll add DNS records — DKIM + SPF + Return-Path)
2. Create an API key → goes into both `RESEND_API_KEY` env vars (web + api)
3. Optionally swap Supabase's default email sender for Resend at Supabase → Authentication → SMTP → fill in Resend SMTP creds

> **V1 caveat:** `app/services/email_service.py` currently just logs. The Resend integration itself is deferred to "post-V1 hardening" — see [`../POST_V1.md`](../POST_V1.md). Until then, customer-facing ticket emails will only appear in your Railway logs.

---

## 3. Backend — Railway (15 min)

1. **New project → Deploy from GitHub repo** → pick your repo, root directory: `apps/api`
2. Railway auto-detects the `Dockerfile`. Build should succeed in ~3–5 min.
3. **Environment variables** — paste every value from [`apps/api/.env.production.example`](../apps/api/.env.production.example):
   - All `SUPABASE_*` from step 1
   - `CORS_ORIGINS=https://voas.ai,https://www.voas.ai`
   - `SENTRY_DSN`, `RESEND_API_KEY`, `EMAIL_FROM`
   - `ENVIRONMENT=production`
4. **Custom domain**: Railway → Settings → Networking → add `api.voas.ai`. Railway gives you a CNAME — add it to your DNS provider.
5. Wait for SSL to provision (~1 min).
6. Smoke test:
   ```powershell
   curl https://api.voas.ai/v1/health
   ```
   Expect `{"data":{"status":"ok","environment":"production","version":"0.1.0"}}`.

---

## 4. Frontend — Vercel (15 min)

1. **Import project** → pick your repo. **Root directory: `apps/web`**.
2. Framework auto-detects as Next.js. **Install command**: `pnpm install`. **Build command**: `pnpm build`. Leave the rest default.
3. **Environment variables** → paste every value from [`apps/web/.env.production.example`](../apps/web/.env.production.example).
4. Deploy. First build ~3 min.
5. **Custom domain** → Settings → Domains → add `voas.ai` and `www.voas.ai`. Follow Vercel's DNS instructions (usually an A record + CNAME).
6. Wait for SSL (~1 min).
7. Visit `https://voas.ai` — marketing site should load with the same theme as local.

---

## 5. Provision your first admin (5 min)

Admins are not signup-able from the public site. Run the provisioning script against the production Supabase project:

```powershell
cd apps\api
.\.venv\Scripts\Activate.ps1
# Temporarily point your local .env at production
# (or set env vars inline — DON'T commit these)
$env:SUPABASE_URL = "https://<ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "<prod service role key>"
$env:SUPABASE_JWT_SECRET = "<prod jwt secret>"
python -m scripts.create_admin --email you@convosol.com --name "Your Name" --super-admin
```

It prints a generated password — save it. Sign in at `https://voas.ai/admin/login`.

---

## 6. Smoke test in production (5 min)

Walk through the critical path:

1. `https://voas.ai` → marketing site loads
2. `/signup` → create a real user (not the admin one)
3. Check the user's email for the verification link → click it
4. Onboarding wizard → workspace created
5. `/locations` → add a location
6. `/team` → invite a teammate (copy the URL since real email isn't wired yet)
7. `/support` → create a ticket
8. Sign out. `https://voas.ai/admin/login` → log in as admin
9. `/admin/support` → see the ticket → reply
10. Sign out → log back in as the regular user → see your ticket has the reply

If all 10 work, V1 is live.

---

## 7. Observability (optional but strongly recommended)

- **Sentry**: create a project for each of `voas-web` and `voas-api`. Drop the DSN into the relevant env var. Restart deploys.
- **PostHog**: create one project. `NEXT_PUBLIC_POSTHOG_KEY` only. Events flow automatically once the key is set (no code change required — already wired with `lib/analytics.ts`).
- **Uptime monitoring**: BetterStack / UptimeRobot / Pingdom. Monitor:
  - `GET https://voas.ai/` (200 OK)
  - `GET https://api.voas.ai/v1/health` (200 OK, body contains `"status":"ok"`)

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `CORS error` calling API | `CORS_ORIGINS` on Railway doesn't include the prod frontend origin | Add `https://voas.ai` to the list, redeploy |
| Auth callback redirects to localhost | Supabase Site URL still set to localhost | Set Site URL + Redirect URLs to `https://voas.ai` |
| `Invalid token: ExpiredSignatureError` storm | Clock skew between Railway and Supabase | Rare — restart Railway, check NTP |
| Migrations fail on `supabase db push` | Wrong project linked | `supabase link --project-ref <ref>` and re-run |
| Vercel build fails on `useActionState` | Your `react` was bumped to 19 but Next not upgraded | Stay on Next 14 + React 18, keep the compat shim |
| Admin login says "not provisioned" | Forgot to run `scripts/create_admin.py` against prod | Run it (section 5) |

---

## When V1 is officially live

Update [`../CLAUDE.md`](../CLAUDE.md) §1.3 ("Now in pilot") to whatever you want to say publicly. Update [`../SPRINTS.md`](../SPRINTS.md) to mark V1 complete. Start V2.

Run `gh release create v1.0.0` to tag.

---

**Last updated: end of V1 Sprint 6.**
