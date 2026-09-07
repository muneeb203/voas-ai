-- Add workspace timezone preference
alter table workspaces add column timezone text not null default 'America/New_York';

-- Create index for queries by timezone
create index idx_workspaces_timezone on workspaces(timezone);
