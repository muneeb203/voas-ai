-- Appointment confirmations + reminders (salon).
--
-- Per-workspace settings live on voice_settings (already the home of
-- send_order_confirmations). Reminders are fully configurable: reminder_lead_minutes
-- is a list of "minutes before the appointment" offsets, e.g. {1440} = 24h,
-- {1440,120} = 24h and 2h.
--
-- The API runs a periodic background sweep that sends due reminders. Each
-- (appointment, lead) send is recorded in appointment_reminders_sent with a
-- unique constraint, so a restart — or a second API instance — can never
-- double-send the same reminder.

alter table public.voice_settings
  add column if not exists send_appointment_confirmations boolean not null default true,
  add column if not exists send_appointment_reminders boolean not null default true,
  add column if not exists reminder_lead_minutes integer[] not null default '{1440}';

alter table public.salon_appointments
  add column if not exists confirmation_sent_at timestamptz;

create table if not exists public.appointment_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.salon_appointments(id) on delete cascade,
  lead_minutes integer not null,
  sent_at timestamptz not null default now(),
  unique (appointment_id, lead_minutes)
);

create index if not exists idx_appt_reminders_sent_appt
  on public.appointment_reminders_sent(appointment_id);

-- Only the FastAPI service role writes reminder records.
alter table public.appointment_reminders_sent enable row level security;
create policy "appointment_reminders_sent service only"
  on public.appointment_reminders_sent for all using (false);
