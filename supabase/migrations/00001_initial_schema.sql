-- VOAS AI — V1 initial schema.
-- Matches CLAUDE.md §4. RLS policies live in 00002_rls_policies.sql.

create extension if not exists "pgcrypto";

------------------------------------------------------------
-- updated_at trigger helper
------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

------------------------------------------------------------
-- workspaces (the tenant)
------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'scale', 'enterprise')),
  vertical text not null default 'restaurant'
    check (vertical in ('restaurant', 'dental', 'salon', 'auto', 'other')),
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- workspace_members
------------------------------------------------------------

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'staff')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index idx_workspace_members_user on public.workspace_members(user_id);

------------------------------------------------------------
-- locations
------------------------------------------------------------

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  address text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  phone text,
  timezone text not null default 'America/New_York',
  hours jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_locations_workspace on public.locations(workspace_id);

create trigger trg_locations_updated_at
  before update on public.locations
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- admin_users (VOAS team)
------------------------------------------------------------

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'super_admin')),
  totp_secret text,
  totp_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- support_tickets
------------------------------------------------------------

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  assigned_admin_id uuid references public.admin_users(id),
  subject text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_support_tickets_workspace on public.support_tickets(workspace_id);
create index idx_support_tickets_status on public.support_tickets(status);

create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- support_messages
------------------------------------------------------------

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin', 'system')),
  sender_id uuid not null,
  body text not null,
  attachments jsonb,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_support_messages_ticket on public.support_messages(ticket_id);

------------------------------------------------------------
-- chat_sessions / chat_messages (V1.5 — schema ready, feature deferred)
------------------------------------------------------------

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  started_by uuid not null references auth.users(id),
  claimed_by_admin_id uuid references public.admin_users(id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  fallback_ticket_id uuid references public.support_tickets(id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin', 'system')),
  sender_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- audit_logs (immutable — see RLS migration)
------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'admin', 'system')),
  actor_id uuid not null,
  workspace_id uuid references public.workspaces(id),
  action text not null,
  resource_type text,
  resource_id uuid,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_workspace on public.audit_logs(workspace_id);
create index idx_audit_logs_actor on public.audit_logs(actor_type, actor_id);
create index idx_audit_logs_created on public.audit_logs(created_at desc);

------------------------------------------------------------
-- contact_submissions (marketing form)
------------------------------------------------------------

create table public.contact_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  phone text,
  message text not null,
  source text,
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'closed')),
  created_at timestamptz not null default now()
);

------------------------------------------------------------
-- invitations
------------------------------------------------------------

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'manager', 'staff')),
  invited_by uuid not null references auth.users(id),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invitations_workspace on public.invitations(workspace_id);
create index idx_invitations_email on public.invitations(email);
