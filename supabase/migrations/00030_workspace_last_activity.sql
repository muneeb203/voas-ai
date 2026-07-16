-- Per-workspace "last activity" for the admin workspaces list.
--
-- Activity means the business actually did something: took a call/chat, an
-- order, or a booking. Aggregated DB-side on purpose — the admin list would
-- otherwise have to pull every conversation, order and appointment across all
-- workspaces and reduce them in Python just to show one column.

create or replace function public.workspace_last_activity()
returns table (workspace_id uuid, last_activity_at timestamptz)
language sql
stable
as $$
  select workspace_id, max(at) as last_activity_at
  from (
    select workspace_id, started_at as at from public.conversations
    union all
    select workspace_id, created_at as at from public.orders
    union all
    select workspace_id, created_at as at from public.salon_appointments
  ) t
  where workspace_id is not null
  group by workspace_id;
$$;

-- Indexes backing the union above (created_at/started_at scans per workspace).
create index if not exists idx_conversations_ws_started
  on public.conversations(workspace_id, started_at desc);
create index if not exists idx_orders_ws_created
  on public.orders(workspace_id, created_at desc);
