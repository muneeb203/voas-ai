-- VOAS AI — In-app notifications (order alerts + admin product updates).

------------------------------------------------------------
-- announcements (admin-authored broadcasts)
------------------------------------------------------------

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  link text,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_announcements_published on public.announcements(published_at desc);

create trigger trg_announcements_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- notifications (per-user inbox — bell dropdown)
------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete cascade,
  type text not null check (type in ('order_placed', 'product_update')),
  title text not null,
  body text,
  link text,
  resource_type text,
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index idx_notifications_user_unread on public.notifications(user_id) where read_at is null;

------------------------------------------------------------
-- RLS
------------------------------------------------------------

alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

create policy "announcements locked down"
  on public.announcements for all using (false);

create policy "users read own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "users mark own notifications read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
