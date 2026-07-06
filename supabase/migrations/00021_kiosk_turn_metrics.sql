-- Per-turn kiosk performance metrics: which STT provider served the turn, its
-- confidence, the chat/TTS latencies, and whether the turn placed an order.
-- Powers the admin "Kiosk Performance" card. Written best-effort by the kiosk
-- client after each turn via POST /v1/kiosk/{token}/metrics.

create table if not exists kiosk_turn_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  stt_source text not null default 'browser',   -- 'deepgram' | 'browser'
  stt_confidence numeric,                        -- 0..1; null on browser-fallback turns
  chat_ms integer,
  anthropic_ms integer,
  tts_ms integer,
  order_placed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_kiosk_turn_metrics_ws_created
  on kiosk_turn_metrics (workspace_id, created_at desc);

-- Only the FastAPI service role (which bypasses RLS) touches this table.
-- Locked down for everyone else.
alter table kiosk_turn_metrics enable row level security;

drop policy if exists "kiosk_turn_metrics service only" on kiosk_turn_metrics;
create policy "kiosk_turn_metrics service only"
  on kiosk_turn_metrics for all using (false);

-- Aggregate summary for a workspace over an optional time window.
-- Pass p_since = null for all-time.
create or replace function kiosk_metrics_summary(p_workspace_id uuid, p_since timestamptz)
returns table (
  total_turns bigint,
  deepgram_turns bigint,
  avg_confidence numeric,
  avg_chat_ms numeric,
  avg_tts_ms numeric,
  orders_placed bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where stt_source = 'deepgram')::bigint,
    round(avg(stt_confidence) filter (where stt_confidence is not null)::numeric, 3),
    round(avg(chat_ms) filter (where chat_ms is not null)::numeric, 0),
    round(avg(tts_ms) filter (where tts_ms is not null)::numeric, 0),
    count(*) filter (where order_placed)::bigint
  from kiosk_turn_metrics
  where workspace_id = p_workspace_id
    and (p_since is null or created_at >= p_since);
$$;
