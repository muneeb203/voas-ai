-- Update billing plan prices and limits to match new pricing ($99/$199/$299).

update public.billing_plans set
  price_cents_monthly = 9900,
  voice_minutes_limit = 200
where slug = 'essentials';

update public.billing_plans set
  price_cents_monthly = 19900,
  voice_minutes_limit = 500
where slug = 'professional';

update public.billing_plans set
  price_cents_monthly = 29900,
  voice_minutes_limit = 1000
where slug = 'business';
