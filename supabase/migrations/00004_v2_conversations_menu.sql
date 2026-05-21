-- VOAS AI — V2 Sprint 1 schema additions.
-- New tables: customers, conversations, conversation_messages,
-- orders, menu_categories, menu_items, menu_modifier_groups,
-- menu_modifier_options. RLS at the bottom.

------------------------------------------------------------
-- customers
------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  phone text,
  name text,
  email text,
  total_orders integer not null default 0,
  total_spent_cents bigint not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, phone)
);

create index idx_customers_workspace on public.customers(workspace_id);
create index idx_customers_phone on public.customers(workspace_id, phone);

create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- conversations
------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('voice', 'whatsapp', 'chat', 'sms')),
  customer_phone text,
  customer_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  status text not null default 'active'
    check (status in ('active', 'ended', 'abandoned', 'escalated')),
  sentiment numeric(3, 2),                           -- -1.00 .. 1.00, null when unknown
  summary text,
  recording_url text,
  outcome text,                                      -- 'order_placed', 'question_answered', 'booking_made', 'escalated', 'no_resolution'
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conversations_workspace on public.conversations(workspace_id);
create index idx_conversations_started on public.conversations(workspace_id, started_at desc);
create index idx_conversations_status on public.conversations(workspace_id, status);
create index idx_conversations_channel on public.conversations(workspace_id, channel);
create index idx_conversations_customer on public.conversations(customer_id);

create trigger trg_conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- conversation_messages
------------------------------------------------------------

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('customer', 'agent', 'system')),
  content text not null,
  audio_url text,
  created_at timestamptz not null default now()
);

create index idx_conversation_messages_conversation on public.conversation_messages(conversation_id, created_at);

------------------------------------------------------------
-- orders
------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'preparing', 'ready', 'fulfilled', 'cancelled', 'refunded')),
  total_cents bigint not null default 0,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  tip_cents bigint not null default 0,
  items_json jsonb not null default '[]'::jsonb,     -- snapshot of items at time of order
  customer_phone text,
  customer_name text,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'partial_refund', 'refunded', 'failed')),
  pos_order_id text,                                 -- populated in V2 Sprint 4 when POS syncs
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_workspace on public.orders(workspace_id);
create index idx_orders_created on public.orders(workspace_id, created_at desc);
create index idx_orders_status on public.orders(workspace_id, status);
create index idx_orders_conversation on public.orders(conversation_id);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- menu_categories
------------------------------------------------------------

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_categories_workspace on public.menu_categories(workspace_id, sort_order);

create trigger trg_menu_categories_updated_at
  before update on public.menu_categories
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- menu_items
------------------------------------------------------------

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category_id uuid not null references public.menu_categories(id) on delete cascade,
  name text not null,
  description text,
  price_cents bigint not null default 0,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_items_workspace on public.menu_items(workspace_id);
create index idx_menu_items_category on public.menu_items(category_id, sort_order);

create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- menu_modifier_groups
------------------------------------------------------------

create table public.menu_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items(id) on delete cascade,
  name text not null,                                -- e.g. "Size", "Toppings"
  min_select integer not null default 0,
  max_select integer not null default 1,
  required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_menu_modifier_groups_item on public.menu_modifier_groups(item_id, sort_order);

------------------------------------------------------------
-- menu_modifier_options
------------------------------------------------------------

create table public.menu_modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name text not null,                                -- e.g. "Large", "Extra cheese"
  price_delta_cents bigint not null default 0,      -- can be negative (discount)
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_menu_modifier_options_group on public.menu_modifier_options(group_id, sort_order);

------------------------------------------------------------
-- RLS — workspace-scoped pattern matching V1 tables
------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.orders enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.menu_modifier_groups enable row level security;
alter table public.menu_modifier_options enable row level security;

-- Customers, conversations, orders: members read; service role mutates.
create policy "members read customers"
  on public.customers for select using (public.is_workspace_member(workspace_id));

create policy "members read conversations"
  on public.conversations for select using (public.is_workspace_member(workspace_id));

create policy "members read conversation messages"
  on public.conversation_messages for select using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_messages.conversation_id
        and public.is_workspace_member(c.workspace_id)
    )
  );

create policy "members read orders"
  on public.orders for select using (public.is_workspace_member(workspace_id));

-- Menu: members read, owners manage. (Mirrors locations.)
create policy "members read menu categories"
  on public.menu_categories for select using (public.is_workspace_member(workspace_id));

create policy "owners manage menu categories"
  on public.menu_categories for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "members read menu items"
  on public.menu_items for select using (public.is_workspace_member(workspace_id));

create policy "owners manage menu items"
  on public.menu_items for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "members read modifier groups"
  on public.menu_modifier_groups for select using (
    exists (
      select 1 from public.menu_items i
      where i.id = menu_modifier_groups.item_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

create policy "owners manage modifier groups"
  on public.menu_modifier_groups for all
  using (
    exists (
      select 1 from public.menu_items i
      where i.id = menu_modifier_groups.item_id
        and public.is_workspace_owner(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_items i
      where i.id = menu_modifier_groups.item_id
        and public.is_workspace_owner(i.workspace_id)
    )
  );

create policy "members read modifier options"
  on public.menu_modifier_options for select using (
    exists (
      select 1 from public.menu_modifier_groups g
      join public.menu_items i on i.id = g.item_id
      where g.id = menu_modifier_options.group_id
        and public.is_workspace_member(i.workspace_id)
    )
  );

create policy "owners manage modifier options"
  on public.menu_modifier_options for all
  using (
    exists (
      select 1 from public.menu_modifier_groups g
      join public.menu_items i on i.id = g.item_id
      where g.id = menu_modifier_options.group_id
        and public.is_workspace_owner(i.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.menu_modifier_groups g
      join public.menu_items i on i.id = g.item_id
      where g.id = menu_modifier_options.group_id
        and public.is_workspace_owner(i.workspace_id)
    )
  );
