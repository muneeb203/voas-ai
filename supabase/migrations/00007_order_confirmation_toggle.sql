-- VOAS AI — V2 order confirmation messages.
-- Per-workspace toggle for auto-sending a WhatsApp/SMS confirmation after
-- every order. Lives on voice_settings (one row per workspace) since that's
-- already the workspace-level agent config table.

alter table public.voice_settings
  add column if not exists send_order_confirmations boolean not null default true;
