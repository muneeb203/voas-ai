-- Tap-to-order mode on the kiosk, alongside voice.
--
-- Admin-gated: only the VOAS team turns this on per workspace while it rolls
-- out. When off, the kiosk behaves exactly as before and the public menu /
-- manual-order endpoints refuse the request.
--
-- Restaurant only for now; salon kiosks stay voice-only.

alter table public.workspace_kiosk_settings
  add column if not exists manual_ordering_enabled boolean not null default false;
