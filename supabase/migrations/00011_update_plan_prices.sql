-- Update billing plan prices and voice minute limits to match new pricing structure.
-- Payments are handled manually by admin; price_cents_monthly is for reference display only.

update public.billing_plans set
  price_cents_monthly = 6000,
  voice_minutes_limit = 200
where slug = 'essentials';

update public.billing_plans set
  price_cents_monthly = 12000,
  voice_minutes_limit = 500,
  whatsapp_messages_limit = 1500
where slug = 'professional';

update public.billing_plans set
  price_cents_monthly = 25000,
  voice_minutes_limit = 1200,
  whatsapp_messages_limit = 4000
where slug = 'business';
