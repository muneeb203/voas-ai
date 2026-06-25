-- Add a zero-quota trial plan for new workspace signups.
-- New workspaces start here; admin upgrades them to a paid plan once they pay.

insert into public.billing_plans (
  slug, name, price_cents_monthly,
  voice_minutes_limit, whatsapp_messages_limit, help_bot_turns_limit,
  allowed_channels, sort_order
) values (
  'trial', 'Trial', 0,
  0, 0, 50,
  '{voice}', 0
) on conflict (slug) do nothing;

-- Expand the plan check constraint to include 'trial'.
alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('trial', 'essentials', 'professional', 'business', 'enterprise'));

-- New workspaces default to trial (not professional).
alter table public.workspaces alter column plan set default 'trial';
