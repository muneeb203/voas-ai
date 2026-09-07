-- Broaden notification types (more business + admin events) and turn on
-- Supabase Realtime for the table so the in-app bell can subscribe instead of
-- polling. RLS already restricts each user to their own rows (00008), which is
-- what makes a realtime subscription safe per-user.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    -- business users
    'order_placed', 'product_update', 'usage_limit',
    'ticket_reply', 'ticket_resolved', 'kiosk_low', 'appointment_booked',
    -- admin team
    'admin_signup', 'admin_error', 'admin_ticket', 'admin_limit'
  ));

-- Add the table to the realtime publication (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
