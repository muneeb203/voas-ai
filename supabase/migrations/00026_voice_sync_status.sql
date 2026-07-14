-- Voice assistant sync status. Saving voice settings now persists immediately
-- and pushes to Vapi in the background, so the dashboard never blocks on a slow
-- Vapi round-trip. These columns let the UI report how that background sync went.
--
--   pending → queued / in flight
--   synced  → assistant updated on Vapi
--   error   → Vapi rejected the update (sync_error holds the message)

alter table public.voice_settings
  add column if not exists sync_status text not null default 'synced',
  add column if not exists sync_error text;
