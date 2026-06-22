-- Workspace-level kiosk appearance and security settings
create table workspace_kiosk_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  theme text not null default 'gradient' check (theme in ('warm', 'light', 'gradient')),
  session_lock_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workspace_kiosk_settings enable row level security;

create policy "members can read kiosk settings" on workspace_kiosk_settings for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));

create policy "owners can insert kiosk settings" on workspace_kiosk_settings for insert
  with check (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'
  ));

create policy "owners can update kiosk settings" on workspace_kiosk_settings for update
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'
  ));

-- Session lock columns on kiosk_tokens
alter table kiosk_tokens
  add column active_session_id text,
  add column session_heartbeat_at timestamptz;
