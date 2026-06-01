# Google sign-in (Phase 1) — manual setup

Login and signup with Google are already wired in the app. You only need **Google Cloud credentials** and **Supabase provider config**. Password reset / Gmail SMTP are out of scope for this phase.

---

## What you need before starting

| Requirement | Why |
|-------------|-----|
| Docker Desktop running | `supabase start` |
| Supabase CLI | `npm install -g supabase` |
| A Google account | OAuth consent + test user |
| ~15 minutes | One-time Google Cloud setup |

---

## Part A — Google Cloud Console (manual, one time)

### Step 1: Create or pick a project

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Top bar → select a project or **New project** (e.g. `VOAS AI Dev`).

### Step 2: OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**.
2. User type: **External** (unless you use Google Workspace and want Internal only).
3. Fill **App name** (e.g. `VOAS AI`), **User support email**, **Developer contact email** → Save.
4. **Scopes** → Add if missing:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
5. **Test users** → **Add users** → add every Gmail you will sign in with while the app is in **Testing** mode (required; only those accounts can log in).

### Step 3: Create OAuth client ID

1. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
2. Application type: **Web application**.
3. Name: e.g. `VOAS AI Local`.

**Authorized JavaScript origins**

| Environment | Origin |
|-------------|--------|
| Local (required now) | `http://localhost:3001` |

**Authorized redirect URIs** (Supabase receives Google’s callback — not your Next.js app)

| Environment | Redirect URI |
|-------------|----------------|
| Local (required now) | `http://localhost:54321/auth/v1/callback` |

4. **Create** → copy **Client ID** and **Client secret** (you need both once).

> **Production later:** add your live app origin (e.g. `https://voas.ai`) and hosted Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback` to the same OAuth client (or create a second client).

---

## Part B — Local Supabase (manual)

### Step 4: Supabase secrets file

From the repo root:

```powershell
cd E:\convosol\VOAS-AI\frontend
copy supabase\.env.example supabase\.env
```

Edit `supabase/.env` (this file is gitignored):

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=your-client-secret
```

Paste the values from Google Cloud Step 3.

### Step 5: Restart Supabase so config loads

```powershell
supabase stop
supabase start
```

Confirm Google is enabled:

- Open http://localhost:54323 → **Authentication** → **Providers** → **Google** should be **enabled**.

Or check `supabase/config.toml` — `[auth.external.google]` has `enabled = true`.

### Step 6: Web app env (if not done yet)

```powershell
copy apps\web\.env.local.example apps\web\.env.local
```

After `supabase start`, set at least:

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase start output>
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Part C — Run the stack and test

### Step 7: Start services (3 terminals)

**Terminal 1 — Supabase** (if not already running):

```powershell
cd E:\convosol\VOAS-AI\frontend
supabase start
```

**Terminal 2 — API** (dashboard needs this):

```powershell
cd E:\convosol\VOAS-AI\frontend\apps\api
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

**Terminal 3 — Frontend:**

```powershell
cd E:\convosol\VOAS-AI\frontend
pnpm dev
```

### Step 8: Test Google login

| # | Action | Expected |
|---|--------|----------|
| 1 | Open http://localhost:3001/login | Page loads |
| 2 | Click **Continue with Google** | Redirect to Google |
| 3 | Pick a **test user** Gmail | Redirect back to app |
| 4 | New user | `/onboarding` (no workspace yet) |
| 5 | Complete onboarding | `/dashboard` |
| 6 | Sign out → Google again | `/dashboard` |
| 7 | http://localhost:3001/signup → **Sign up with Google** | Same flow, lands on `/onboarding` if new |

**Studio check:** http://localhost:54323 → **Authentication** → **Users** — new row with Google provider.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `database files are incompatible` / PG 15 vs 17 | Wipe local DB volume (see below) — dev data only |
| `redirect_uri_mismatch` | Google redirect URI must be exactly `http://localhost:54321/auth/v1/callback` |
| `access_denied` / can’t pick account | Add that Gmail under OAuth consent screen → **Test users** |
| `Provider google is not enabled` | Fill `supabase/.env`, set `enabled = true`, run `supabase stop` then `supabase start` |
| Returns to login with error | Read `?error=` in URL; check Studio → Auth logs |
| Dashboard error after login | Start FastAPI on port **8000** |
| Nonce / validation error (rare locally) | In `supabase/config.toml` set `skip_nonce_check = true` under `[auth.external.google]`, restart Supabase |
| Wrong port | App uses **3001** (`pnpm dev`), not 3000 — origins must match |

### PostgreSQL 15 → 17 error on `supabase start`

If you see `initialized by PostgreSQL version 15, which is not compatible with ... 17`:

```powershell
cd E:\convosol\VOAS-AI\frontend
supabase stop --no-backup
docker volume rm supabase_db_voas-ai
supabase start
supabase db reset
```

This deletes **local** DB data only (users, workspaces). Migrations + `seed.sql` are reapplied. Re-fill `supabase/.env` Google keys if needed; copy anon key from `supabase start` output into `apps/web/.env.local`.

---

## Production (when you deploy)

Do **not** commit secrets. On **hosted Supabase**:

1. **Authentication** → **URL configuration**  
   - Site URL: `https://<your-domain>`  
   - Redirect URLs: `https://<your-domain>/**`
2. **Authentication** → **Providers** → **Google** → enable, paste Client ID + secret.
3. Google Cloud → add production origins + `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Vercel/host env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.

OAuth consent: move from **Testing** to **Published** when you’re ready for any Google user to sign in.

---

## Code reference (already implemented)

| Piece | Location |
|-------|----------|
| Google button | `apps/web/components/auth/google-button.tsx` |
| Login / signup | `login-form.tsx`, `signup-form.tsx` |
| OAuth callback | `apps/web/app/auth/callback/route.ts` |
| Supabase Google config | `supabase/config.toml` → `[auth.external.google]` |
