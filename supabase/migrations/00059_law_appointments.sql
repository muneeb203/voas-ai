-- Law vertical appointments (simpler than salon/dental - no staff management)

create table law_appointments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_id uuid references salon_services(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  customer_email text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for common queries
create index idx_law_appointments_workspace on law_appointments(workspace_id);
create index idx_law_appointments_starts_at on law_appointments(starts_at);
create index idx_law_appointments_customer on law_appointments(customer_phone);

-- Row-level security: members can read/write own workspace
alter table law_appointments enable row level security;

create policy "members can read own workspace law appointments" on law_appointments for select
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "members can write own workspace law appointments" on law_appointments for insert
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));

create policy "members can update own workspace law appointments" on law_appointments for update
  using (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()))
  with check (workspace_id in (select workspace_id from workspace_members where user_id = auth.uid()));
