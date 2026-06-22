-- Kiosk tokens: one token per location, used for the Self Order kiosk URL
create table kiosk_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_kiosk_tokens_workspace on kiosk_tokens(workspace_id);
create index idx_kiosk_tokens_location on kiosk_tokens(location_id);
create index idx_kiosk_tokens_token on kiosk_tokens(token) where is_active = true;

alter table kiosk_tokens enable row level security;

create policy "members can read workspace kiosk tokens" on kiosk_tokens for select
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid()
  ));

create policy "owners can insert kiosk tokens" on kiosk_tokens for insert
  with check (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'
  ));

create policy "owners can update kiosk tokens" on kiosk_tokens for update
  using (workspace_id in (
    select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'
  ));
