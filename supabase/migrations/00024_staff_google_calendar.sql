-- Per-staff Google Calendar connection (two-way sync). Each staff member
-- connects their own Google account via one shared OAuth app; tokens are stored
-- here (service-role only). Appointments push to their calendar, and the
-- booking engine reads their Google free/busy so the AI won't double-book.

create table public.staff_google_calendar (
  staff_id uuid primary key references public.salon_staff(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  google_email text,
  access_token text not null,
  refresh_token text not null,
  token_expiry timestamptz not null,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_staff_google_calendar_workspace on public.staff_google_calendar(workspace_id);

create trigger trg_staff_google_calendar_updated_at
  before update on public.staff_google_calendar
  for each row execute function public.set_updated_at();

-- Only the FastAPI service role touches OAuth tokens. Locked down otherwise.
alter table public.staff_google_calendar enable row level security;
create policy "staff_google_calendar service only"
  on public.staff_google_calendar for all using (false);

-- Link an appointment to its Google Calendar event, so reschedule/cancel can
-- update/remove it.
alter table public.salon_appointments
  add column if not exists google_event_id text;
