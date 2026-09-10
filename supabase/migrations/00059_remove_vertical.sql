-- Remove vertical column from workspaces table
-- This simplifies the app - no more vertical-specific logic

alter table workspaces drop column if exists vertical;
