-- QR / phone ordering: customers scan a table QR and order from their own
-- phone. Distinct from the kiosk (which is one session-locked screen) — phone
-- ordering is many concurrent devices, tap-to-order only, pickup by order
-- number. Admin-gated per workspace while it rolls out; restaurant only.

alter table public.workspace_kiosk_settings
  add column if not exists phone_ordering_enabled boolean not null default false;
