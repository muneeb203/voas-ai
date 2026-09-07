-- Owner-editable kiosk voice: tone/personality and what the assistant tells
-- customers about collecting their order. Kept separate per vertical so a
-- workspace that switches restaurant<->salon keeps both.
--
-- Deliberately NOT the whole system prompt: the operational rules (offer only
-- real menu items, always call place_order) stay locked in code. These fields
-- are appended to them, so an owner can change how the kiosk sounds but cannot
-- break ordering.

alter table public.workspace_kiosk_settings
  add column if not exists restaurant_tone text,
  add column if not exists restaurant_handover text,
  add column if not exists salon_tone text,
  add column if not exists salon_handover text;
