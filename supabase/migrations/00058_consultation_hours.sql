-- Workspace consultation hours (for law, salons, and other verticals without staff management)
-- Stores availability by weekday and time for the workspace

create table workspace_consultation_hours (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  hours jsonb not null default '{}'::jsonb,
  -- Format: {"mon": {"enabled": true, "start": "09:00", "end": "17:00"}, ...}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for common queries
create index idx_workspace_consultation_hours_workspace on workspace_consultation_hours(workspace_id);

-- Row-level security: members can read/write own workspace hours
alter table workspace_consultation_hours enable row level security;

create policy "members can read own workspace consultation hours" on workspace_consultation_hours for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "owners can write own workspace consultation hours" on workspace_consultation_hours for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

create policy "owners can update own workspace consultation hours" on workspace_consultation_hours for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));
