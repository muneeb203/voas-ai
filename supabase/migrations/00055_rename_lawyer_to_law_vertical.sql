-- Rename lawyer vertical to law
alter table public.workspaces
drop constraint workspaces_vertical_check;

alter table public.workspaces
add constraint workspaces_vertical_check
check (vertical in ('default', 'restaurant', 'law', 'dental', 'salon', 'auto', 'other'));

-- Migrate existing lawyer records to law
update public.workspaces
set vertical = 'law'
where vertical = 'lawyer';
