-- Walk-in check-in support: when a customer arrives and checks in at the kiosk
-- (or a staff member marks them present), stamp the appointment.
alter table public.salon_appointments
  add column if not exists checked_in_at timestamptz;
