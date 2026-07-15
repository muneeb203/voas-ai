-- Admin impersonation grants.
--
-- Starting an impersonation now records a real, expiring grant. The API checks
-- this table to let an admin act inside a workspace they aren't a member of.
-- Without a live grant, admins are refused by workspace-scoped endpoints exactly
-- like any other non-member — the grant is the ONLY thing that opens that door,
-- it expires on its own, and ending impersonation closes it immediately.
--
-- admin_user_id is the auth.users id (the JWT subject) so the API can check the
-- grant straight from the caller's token. admin_id is the admin_users row, kept
-- for auditing.

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.admin_users(id) on delete cascade,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hot path: "does this admin hold a live grant on this workspace?"
create index idx_impersonation_sessions_active
  on public.impersonation_sessions(admin_user_id, workspace_id, ended_at, expires_at);

-- Only the FastAPI service role touches grants.
alter table public.impersonation_sessions enable row level security;
create policy "impersonation_sessions service only"
  on public.impersonation_sessions for all using (false);
