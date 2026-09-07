-- Dental vertical: scheduling, services, staff, and appointment management.
-- Mirrors salon_scheduling but adapted for dental procedures and terminology.

-- Dental services (procedures like cleaning, root canal, filling, etc.)
create table dental_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes int not null check (duration_minutes > 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  price_cents int not null check (price_cents >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dental staff (dentists, hygienists, assistants)
create table dental_staff (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Many-to-many: which staff can perform which services
create table dental_staff_services (
  staff_id uuid not null references dental_staff(id) on delete cascade,
  service_id uuid not null references dental_services(id) on delete cascade,
  primary key (staff_id, service_id)
);

-- Working hours for each staff member per weekday (Sun=0...Sat=6)
create table dental_staff_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references dental_staff(id) on delete cascade,
  weekday int not null check (weekday >= 0 and weekday <= 6),
  start_time time not null,
  end_time time not null,
  break_start time,
  break_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(staff_id, weekday)
);

-- Booked appointments (UTC timestamps)
create table dental_appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  service_id uuid not null references dental_services(id),
  staff_id uuid not null references dental_staff(id),
  customer_id uuid references customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  customer_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  conversation_id uuid references conversations(id) on delete set null,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_dental_services_workspace on dental_services(workspace_id);
create index idx_dental_services_is_active on dental_services(workspace_id, is_active);
create index idx_dental_staff_workspace on dental_staff(workspace_id);
create index idx_dental_staff_is_active on dental_staff(workspace_id, is_active);
create index idx_dental_staff_services_service_id on dental_staff_services(service_id);
create index idx_dental_appointments_workspace on dental_appointments(workspace_id);
create index idx_dental_appointments_staff on dental_appointments(staff_id);
create index idx_dental_appointments_service on dental_appointments(service_id);
create index idx_dental_appointments_starts_at on dental_appointments(starts_at);
create index idx_dental_appointments_customer on dental_appointments(customer_phone);

-- Row-level security: members see their workspace's data only
alter table dental_services enable row level security;
alter table dental_staff enable row level security;
alter table dental_staff_services enable row level security;
alter table dental_staff_hours enable row level security;
alter table dental_appointments enable row level security;

-- Services: members can read/write own workspace
create policy "members can read own workspace dental services" on dental_services for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "owners can write own workspace dental services" on dental_services for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

create policy "owners can update own workspace dental services" on dental_services for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

create policy "owners can delete own workspace dental services" on dental_services for delete
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

-- Staff: members can read/write own workspace
create policy "members can read own workspace dental staff" on dental_staff for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "owners can write own workspace dental staff" on dental_staff for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

create policy "owners can update own workspace dental staff" on dental_staff for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

create policy "owners can delete own workspace dental staff" on dental_staff for delete
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner'));

-- Staff services: members can read, owners can write
create policy "members can read own workspace dental staff services" on dental_staff_services for select
  using (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())));

create policy "owners can write own workspace dental staff services" on dental_staff_services for insert
  with check (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')));

create policy "owners can delete own workspace dental staff services" on dental_staff_services for delete
  using (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')));

-- Staff hours: members can read, owners can write
create policy "members can read own workspace dental staff hours" on dental_staff_hours for select
  using (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid())));

create policy "owners can write own workspace dental staff hours" on dental_staff_hours for insert
  with check (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')));

create policy "owners can update own workspace dental staff hours" on dental_staff_hours for update
  using (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')))
  with check (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')));

create policy "owners can delete own workspace dental staff hours" on dental_staff_hours for delete
  using (staff_id in (select id from dental_staff where workspace_id in (select workspace_id from workspace_members where user_id = auth.uid() and role = 'owner')));

-- Appointments: all members can read, staff can write
create policy "members can read own workspace dental appointments" on dental_appointments for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "members can write own workspace dental appointments" on dental_appointments for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "members can update own workspace dental appointments" on dental_appointments for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));
