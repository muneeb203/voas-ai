-- VOAS AI — Salon vertical: services, staff, working hours, and appointments.
-- Per-staff calendars: each service maps to the staff who can perform it, each
-- staff member has weekly working hours, and the booking engine computes free
-- slots from (staff hours − existing appointments − buffers). Times in staff
-- hours are LOCAL to the location's timezone; appointments store UTC timestamptz.

------------------------------------------------------------
-- salon_services
------------------------------------------------------------

create table public.salon_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  price_cents bigint not null default 0,
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_salon_services_workspace on public.salon_services(workspace_id, sort_order);

create trigger trg_salon_services_updated_at
  before update on public.salon_services
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- salon_staff
------------------------------------------------------------

create table public.salon_staff (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  title text,                                        -- e.g. "Senior Stylist"
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_salon_staff_workspace on public.salon_staff(workspace_id, sort_order);

create trigger trg_salon_staff_updated_at
  before update on public.salon_staff
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- salon_staff_services  (which staff can perform which service)
------------------------------------------------------------

create table public.salon_staff_services (
  staff_id uuid not null references public.salon_staff(id) on delete cascade,
  service_id uuid not null references public.salon_services(id) on delete cascade,
  primary key (staff_id, service_id)
);

create index idx_salon_staff_services_service on public.salon_staff_services(service_id);

------------------------------------------------------------
-- salon_staff_hours  (weekly working hours; absence of a row = day off)
-- weekday: 0=Sunday .. 6=Saturday (matches Postgres extract(dow)).
-- start_time/end_time are LOCAL to the location timezone.
------------------------------------------------------------

create table public.salon_staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.salon_staff(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create index idx_salon_staff_hours_staff on public.salon_staff_hours(staff_id, weekday);

------------------------------------------------------------
-- salon_appointments
------------------------------------------------------------

create table public.salon_appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  staff_id uuid references public.salon_staff(id) on delete set null,
  service_id uuid references public.salon_services(id) on delete set null,
  service_name text not null,                        -- snapshot at booking time
  staff_name text,                                   -- snapshot at booking time
  customer_phone text,
  customer_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  price_cents bigint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index idx_salon_appointments_workspace on public.salon_appointments(workspace_id, starts_at desc);
create index idx_salon_appointments_staff_time on public.salon_appointments(staff_id, starts_at);
create index idx_salon_appointments_status on public.salon_appointments(workspace_id, status);
create index idx_salon_appointments_conversation on public.salon_appointments(conversation_id);

create trigger trg_salon_appointments_updated_at
  before update on public.salon_appointments
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- RLS — workspace-scoped, mirroring the menu/orders pattern.
-- Members read; owners manage config; service role (FastAPI) handles bookings.
------------------------------------------------------------

alter table public.salon_services enable row level security;
alter table public.salon_staff enable row level security;
alter table public.salon_staff_services enable row level security;
alter table public.salon_staff_hours enable row level security;
alter table public.salon_appointments enable row level security;

-- Services
create policy "members read salon services"
  on public.salon_services for select using (public.is_workspace_member(workspace_id));
create policy "owners manage salon services"
  on public.salon_services for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Staff
create policy "members read salon staff"
  on public.salon_staff for select using (public.is_workspace_member(workspace_id));
create policy "owners manage salon staff"
  on public.salon_staff for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

-- Staff ↔ services (scoped through the staff row)
create policy "members read salon staff services"
  on public.salon_staff_services for select using (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_services.staff_id
        and public.is_workspace_member(s.workspace_id)
    )
  );
create policy "owners manage salon staff services"
  on public.salon_staff_services for all
  using (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_services.staff_id
        and public.is_workspace_owner(s.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_services.staff_id
        and public.is_workspace_owner(s.workspace_id)
    )
  );

-- Staff hours (scoped through the staff row)
create policy "members read salon staff hours"
  on public.salon_staff_hours for select using (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_hours.staff_id
        and public.is_workspace_member(s.workspace_id)
    )
  );
create policy "owners manage salon staff hours"
  on public.salon_staff_hours for all
  using (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_hours.staff_id
        and public.is_workspace_owner(s.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.salon_staff s
      where s.id = salon_staff_hours.staff_id
        and public.is_workspace_owner(s.workspace_id)
    )
  );

-- Appointments: members read; service role mutates (mirrors orders).
create policy "members read salon appointments"
  on public.salon_appointments for select using (public.is_workspace_member(workspace_id));
