-- Per-workspace error log, surfaced in the admin panel so support can see what
-- actually broke for a specific business without digging through platform logs.
--
-- Two kinds:
--   crash       — an unhandled 500 from the API
--   integration — a third-party failure that breaks a real flow for the
--                 business (Vapi, Twilio, Google Calendar, OpenAI, ...)
--
-- Deliberately NOT a firehose: warnings and expected errors stay in the
-- structured logs. Rows are pruned after 30 days by the API's background loop.

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('crash', 'integration')),
  source text not null,                 -- e.g. 'vapi_book_failed', 'unhandled_exception'
  message text not null,
  context jsonb,                        -- small, non-sensitive breadcrumbs
  created_at timestamptz not null default now()
);

-- Hot path: newest errors for one workspace; plus a global sweep for pruning.
create index idx_error_logs_workspace_created
  on public.error_logs(workspace_id, created_at desc);
create index idx_error_logs_created on public.error_logs(created_at);

-- Service-role only: these can contain internal detail, never expose via RLS.
alter table public.error_logs enable row level security;
create policy "error_logs service only" on public.error_logs for all using (false);
