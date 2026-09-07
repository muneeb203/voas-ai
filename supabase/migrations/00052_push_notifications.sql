-- Web Push (PWA "mobile app" notifications).
--
-- Two tables:
--   push_subscriptions      — one row per user *device* (browser push endpoint).
--                             The backend sends to these when the app is closed.
--   workspace_push_settings — one row per workspace, VOAS-admin controlled:
--                             master switch, recipient scope, and per-event
--                             toggles. The in-app bell is unaffected by these;
--                             they only gate the OS-level push.

-- ---------------------------------------------------------------------------
-- Device subscriptions
-- ---------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,          -- the browser's push service URL
  p256dh text not null,                   -- client public key (encryption)
  auth text not null,                     -- client auth secret (encryption)
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- A user manages only their own device subscriptions. The backend uses the
-- service role (bypasses RLS) to fan out pushes.
create policy "users read own push subscriptions" on push_subscriptions for select
  using (user_id = auth.uid());
create policy "users insert own push subscriptions" on push_subscriptions for insert
  with check (user_id = auth.uid());
create policy "users delete own push subscriptions" on push_subscriptions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Per-workspace push settings (admin-controlled)
-- ---------------------------------------------------------------------------
create table if not exists workspace_push_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  push_enabled boolean not null default true,
  recipients text not null default 'owners_managers'
    check (recipients in ('owners_managers', 'all')),
  notify_order boolean not null default true,
  notify_appointment boolean not null default true,
  notify_ticket boolean not null default true,
  notify_kiosk_low boolean not null default true,
  notify_announcement boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workspace_push_settings enable row level security;

-- Members can read their workspace's settings (e.g. to show status). Writes are
-- admin-only via the service role, so no user update/insert policy is granted.
create policy "members read workspace push settings" on workspace_push_settings for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));
