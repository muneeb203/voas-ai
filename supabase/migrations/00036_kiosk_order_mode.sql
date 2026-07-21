-- When a kiosk has manual ordering enabled, the admin picks how it behaves:
--   voice  — voice only, no tap button (same as disabled, kept as an option)
--   manual — tap-to-order only, opens straight to the menu, no voice
--   both   — voice with a "switch to tapping" button (the current behaviour)
--
-- Only meaningful while manual_ordering_enabled is true and the workspace is a
-- restaurant; salon kiosks stay voice-only regardless.

alter table public.workspace_kiosk_settings
  add column if not exists kiosk_order_mode text not null default 'both'
    check (kiosk_order_mode in ('voice', 'manual', 'both'));
