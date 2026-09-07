-- Owner-configurable "one order per device" lock for QR / phone ordering.
-- After a customer places an order, their phone is soft-locked (browser-side)
-- from ordering again for a set window — curbs accidental double orders.

alter table public.workspace_kiosk_settings
  add column if not exists phone_order_lock_enabled boolean not null default false,
  add column if not exists phone_order_lock_minutes integer not null default 30;
