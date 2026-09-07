-- Short, human-friendly order token for kiosk (manual) orders, so a customer
-- and the staff preparing the order can match on a small number instead of a
-- UUID. A per-location daily sequence: order 1, 2, 3 … resetting each day, so
-- the numbers stay small and readable.

alter table public.orders
  add column if not exists order_token text;

-- One counter row per location per day. The day is part of the key, so a new
-- day starts a fresh sequence with no cleanup job.
create table if not exists public.kiosk_order_counters (
  location_id uuid not null references public.locations(id) on delete cascade,
  day date not null,
  seq integer not null default 0,
  primary key (location_id, day)
);

alter table public.kiosk_order_counters enable row level security;
-- Service-role only; the app never touches this table directly, only via the
-- function below. No policies = no access for anon/authenticated.

-- Atomic "give me the next token for this location today". The upsert + returning
-- is a single statement, so two kiosks ordering at the same instant get distinct
-- numbers. security definer so it runs regardless of the caller's row policies.
create or replace function public.next_kiosk_order_token(p_location_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq integer;
begin
  insert into public.kiosk_order_counters (location_id, day, seq)
  values (p_location_id, (now() at time zone 'utc')::date, 1)
  on conflict (location_id, day)
  do update set seq = kiosk_order_counters.seq + 1
  returning seq into v_seq;
  return v_seq;
end;
$$;
