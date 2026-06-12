-- VOAS AI — Usage metering, billing plans, admin credit grants.
-- Rolling 30-day periods anchored on workspaces.created_at.
-- Idempotent where possible for re-runs after partial applies.

------------------------------------------------------------
-- billing_plans (catalog; slug matches workspaces.plan)
------------------------------------------------------------

create table if not exists public.billing_plans (
  slug text primary key,
  name text not null,
  price_cents_monthly integer not null default 0,
  voice_minutes_limit integer,
  whatsapp_messages_limit integer,
  help_bot_turns_limit integer,
  allowed_channels text[] not null default '{voice,whatsapp}',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_billing_plans_updated_at on public.billing_plans;
create trigger trg_billing_plans_updated_at
  before update on public.billing_plans
  for each row execute function public.set_updated_at();

insert into public.billing_plans (
  slug, name, price_cents_monthly,
  voice_minutes_limit, whatsapp_messages_limit, help_bot_turns_limit,
  allowed_channels, sort_order
) values
  ('essentials', 'Essentials', 14900, 300, 0, 50, '{voice}', 1),
  ('professional', 'Professional', 29900, 500, 2000, 100, '{voice,whatsapp}', 2),
  ('business', 'Business', 49900, 1000, 5000, 300, '{voice,whatsapp}', 3),
  ('enterprise', 'Enterprise', 0, null, null, null, '{voice,whatsapp}', 4)
on conflict (slug) do nothing;

------------------------------------------------------------
-- workspaces: new plan slugs + usage controls
------------------------------------------------------------

alter table public.workspaces drop constraint if exists workspaces_plan_check;

update public.workspaces set plan = 'professional' where plan = 'starter';
update public.workspaces set plan = 'business' where plan in ('growth', 'scale');

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('essentials', 'professional', 'business', 'enterprise'));

alter table public.workspaces
  add column if not exists usage_enforcement_disabled boolean not null default false;

alter table public.workspaces
  add column if not exists usage_warnings jsonb not null default '{}'::jsonb;

alter table public.workspaces drop constraint if exists workspaces_plan_fkey;

alter table public.workspaces
  add constraint workspaces_plan_fkey
  foreign key (plan) references public.billing_plans(slug);

alter table public.workspaces alter column plan set default 'professional';

------------------------------------------------------------
-- usage_events (append-only ledger)
------------------------------------------------------------

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  event_type text not null check (
    event_type in (
      'voice_minutes',
      'whatsapp_in',
      'whatsapp_out',
      'help_bot_turn'
    )
  ),
  units integer not null default 1 check (units > 0),
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  provider text check (provider is null or provider in ('openai', 'gemini')),
  conversation_id uuid references public.conversations(id) on delete set null,
  idempotency_key text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create index if not exists idx_usage_events_workspace_created
  on public.usage_events(workspace_id, created_at desc);

create index if not exists idx_usage_events_workspace_type_created
  on public.usage_events(workspace_id, event_type, created_at desc);

------------------------------------------------------------
-- credit_grants (admin bonus pool — never expires until used)
------------------------------------------------------------

create table if not exists public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  credit_type text not null check (
    credit_type in ('voice_minutes', 'whatsapp_messages', 'help_bot_turns')
  ),
  amount_total integer not null check (amount_total > 0),
  amount_remaining integer not null check (amount_remaining >= 0),
  reason text,
  granted_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_grants_workspace
  on public.credit_grants(workspace_id);

------------------------------------------------------------
-- notifications: allow usage_limit type
------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in ('order_placed', 'product_update', 'usage_limit'));

------------------------------------------------------------
-- RLS
------------------------------------------------------------

alter table public.billing_plans enable row level security;
alter table public.usage_events enable row level security;
alter table public.credit_grants enable row level security;

drop policy if exists "billing_plans locked down" on public.billing_plans;
create policy "billing_plans locked down"
  on public.billing_plans for all using (false);

drop policy if exists "usage_events locked down" on public.usage_events;
create policy "usage_events locked down"
  on public.usage_events for all using (false);

drop policy if exists "credit_grants locked down" on public.credit_grants;
create policy "credit_grants locked down"
  on public.credit_grants for all using (false);
