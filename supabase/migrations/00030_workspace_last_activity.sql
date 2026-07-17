-- Per-workspace "last activity" for the admin workspaces list.
--
-- Activity means the business actually did something: took a call/chat, an
-- order, or a booking. Aggregated DB-side on purpose — the admin list would
-- otherwise have to pull every conversation, order and appointment across all
-- workspaces and reduce them in Python just to show one column.
--
-- NOTE: RETURNS TABLE(...) declares OUT parameters, so a bare `workspace_id`
-- in the body is ambiguous against those params and Postgres rejects it. The
-- inner column is aliased to ws_id specifically to avoid that collision — the
-- returned column names still come from RETURNS TABLE, so callers are
-- unaffected. Safe to re-run: create-or-replace + if-not-exists throughout.

create or replace function public.workspace_last_activity()
returns table (workspace_id uuid, last_activity_at timestamptz)
language sql
stable
as $$
  select t.ws_id, max(t.happened_at)
  from (
    select c.workspace_id as ws_id, c.started_at as happened_at
      from public.conversations c
    union all
    select o.workspace_id as ws_id, o.created_at as happened_at
      from public.orders o
    union all
    select a.workspace_id as ws_id, a.created_at as happened_at
      from public.salon_appointments a
  ) t
  where t.ws_id is not null
  group by t.ws_id;
$$;

-- Indexes backing the union above (created_at/started_at scans per workspace).
create index if not exists idx_conversations_ws_started
  on public.conversations(workspace_id, started_at desc);
create index if not exists idx_orders_ws_created
  on public.orders(workspace_id, created_at desc);
