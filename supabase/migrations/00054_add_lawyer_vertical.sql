-- Add 'lawyer' to vertical enum
alter table public.workspaces
drop constraint workspaces_vertical_check;

alter table public.workspaces
add constraint workspaces_vertical_check
check (vertical in ('default', 'restaurant', 'lawyer', 'dental', 'salon', 'auto', 'other'));
