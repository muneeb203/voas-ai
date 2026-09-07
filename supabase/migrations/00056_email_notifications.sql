-- Email notification settings (one per workspace)
create table public.email_notification_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  enabled boolean not null default true,
  recipient_email text not null,
  rate_limit_per_hour integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id)
);

-- Email queue (for rate-limited/queued emails)
create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_email text not null,
  call_data jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  scheduled_time timestamptz not null,
  sent_at timestamptz,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Email logs (history of sent emails)
create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  recipient_email text not null,
  call_data jsonb not null,
  sent_at timestamptz not null default now(),
  status text not null check (status in ('success', 'failed')),
  error_message text
);

-- RLS policies
alter table public.email_notification_settings enable row level security;
alter table public.email_queue enable row level security;
alter table public.email_logs enable row level security;

create policy "workspace members can read their email settings"
on public.email_notification_settings for select
using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "workspace members can read their email logs"
on public.email_logs for select
using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

-- Indexes for performance
create index idx_email_queue_scheduled on public.email_queue(scheduled_time, status);
create index idx_email_queue_workspace on public.email_queue(workspace_id);
create index idx_email_logs_workspace on public.email_logs(workspace_id);
create index idx_email_logs_created on public.email_logs(created_at desc);
