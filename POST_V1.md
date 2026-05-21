# POST_V1 — production hardening backlog

V1 ships as a credible product surface. These items were intentionally deferred to keep V1 scope tight, but **most should be done before serious customer onboarding** in V2.

Ordered by priority. Each item is small enough to land in a single PR.

---

## Production-critical (do these before charging money)

### Real TOTP 2FA for admin login
- **Why:** anyone who phishes an admin password owns the production database via service-role bypass.
- **What:** `pyotp` + QR-code provisioning page at `/admin/setup-2fa`; verification step in admin login flow; force-enroll on first admin login post-deploy.
- **Where:** schema already has `admin_users.totp_secret` and `totp_enabled`.
- **Effort:** ~half a day.

### Real Resend email integration
- **Why:** ticket confirmations, admin replies, invite links, password resets — all currently log to backend stdout, not actual email.
- **What:** swap `_dispatch` in `apps/api/app/services/email_service.py` to a Resend HTTP call. Add HTML templates per event. Verify sender domain.
- **Effort:** ~2 hours once Resend account + domain are set up.

### Audit log: no UPDATE / DELETE at the DB layer
- **Why:** CLAUDE.md §8 rule 11 says audit log is immutable, and we trust the service role not to mutate. Belt-and-suspenders: drop those grants entirely.
- **What:** migration that revokes UPDATE and DELETE on `audit_logs` from all roles including `service_role`. Verify in tests.
- **Effort:** 30 min.

---

## Strongly recommended

### Email attachments on ticket creation
- **Why:** V1 only supports attachments on replies. Users may expect to attach on the first message.
- **What:** "draft folder" path scheme on the Storage bucket (`<workspace_id>/_drafts/<uuid>/...`), then a backend step that moves files into `<workspace_id>/<ticket_id>/...` after ticket creation. Or: support FormData multipart on the create endpoint.
- **Effort:** ~half a day.

### Admin support inbox: bulk actions
- **Why:** as ticket volume grows, single-row actions don't scale.
- **What:** checkbox selection, bulk assign/resolve/archive buttons, with one audit log entry per affected ticket.
- **Effort:** ~half a day.

### CSV export
- **Why:** SOC 2 / customer compliance often asks for "give me my data."
- **What:** `Export` button on audit log + contact submissions. Stream CSV server-side.
- **Effort:** ~3 hours.

### Workspace switcher
- **Why:** V1 assumes one workspace per user. When an admin needs to be a member of multiple workspaces (e.g., for testing), or once we sell to multi-location chains who want sub-workspaces, we need a switcher.
- **What:** dropdown in topbar, cookie-backed active workspace, server-side membership picker in `requireDashboardSession`.
- **Effort:** ~1 day.

### Pagination on heavy lists
- **Why:** `/admin/workspaces`, `/admin/audit-log`, `/admin/tickets` all cap at 100 rows. Past that, admins miss data.
- **What:** cursor pagination on each endpoint (we have the helper pattern in `lib/api/client.ts` already); "Load more" or page nav on the frontend.
- **Effort:** ~half a day per surface.

---

## Nice-to-have

### Google OAuth signup
- **Why:** deferred from Sprint 2 per scoping decision. One-click signup converts ~2x better.
- **What:** turn on the provider in Supabase, add the Google button to `/signup` and `/login`, configure Google Cloud OAuth client + redirect URIs.
- **Effort:** ~2 hours.

### Date range pickers on audit log
- **Why:** "show me everything from yesterday" is a real query.
- **What:** add `from` / `to` date inputs to the audit log filter form; backend already supports any filter combo.
- **Effort:** ~2 hours.

### React 19 upgrade
- **Why:** drop the `useActionState` compat shim in `lib/use-action-state.ts`. Get native `isPending` tracking + future-proof.
- **What:** bump `react`/`react-dom`/`@types/react*` to 19, run typecheck, drop the shim, replace imports back to `from 'react'`.
- **Effort:** ~2 hours including testing.

### Tests
- More backend tests around the admin endpoints (impersonation, role transitions, last-owner protection edge cases).
- E2E test for the admin flow (admin reply → user sees reply).
- Effort: ~1 day total.

### Polish I'm sure I missed
- Image optimization for any future logo/screenshots — `next/image` everywhere.
- Better SEO meta tags on marketing pages.
- Sitemap.xml + robots.txt.

---

## Out of V1 scope entirely (these are V2/V3)

- Real voice integration (Vapi, Twilio)
- WhatsApp Business API
- POS integrations (Toast, Square)
- Stripe billing
- Live chat (Supabase Realtime)
- Conversations page with real data
- Knowledge base editor
- Analytics with real data
- Outbound campaigns
- No-code flow builder
- Public API for customers
- Second vertical (dental/salon)

See `SPRINTS.md` for the V2 / V3 plan.
