-- Per-user onboarding state. Drives the dashboard product tour: auto-shown
-- once for a new user, then never auto-shown again (they can re-launch it
-- manually via "Take a tour"). Read/written by the frontend under RLS.

create table public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tour_completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

create policy "own onboarding select" on public.user_onboarding
  for select using (user_id = auth.uid());

create policy "own onboarding insert" on public.user_onboarding
  for insert with check (user_id = auth.uid());

create policy "own onboarding update" on public.user_onboarding
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
