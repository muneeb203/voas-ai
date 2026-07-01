-- Allow 'kiosk' as a conversation channel so in-store kiosk orders appear in
-- conversation metrics and the analytics channel breakdown, alongside
-- voice / whatsapp / chat / sms.

alter table public.conversations
  drop constraint if exists conversations_channel_check;

alter table public.conversations
  add constraint conversations_channel_check
  check (channel in ('voice', 'whatsapp', 'chat', 'sms', 'kiosk'));
