-- Ticket attachments: private Storage bucket, workspace-scoped RLS.
-- Object path convention: <workspace_id>/<ticket_id>/<uuid>-<filename>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ticket-attachments',
  'ticket-attachments',
  false,
  10485760, -- 10 MB max per file
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip'
  ]
)
on conflict (id) do nothing;

-- Helper: extract workspace_id from object path (first path segment).
create or replace function public.storage_workspace_id_from_path(p_path text)
returns uuid
language sql
immutable
as $$
  select case
    when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_path, '/', 1)::uuid
    else null::uuid
  end;
$$;

------------------------------------------------------------
-- Policies on storage.objects for the ticket-attachments bucket
------------------------------------------------------------

-- Read: any member of the workspace can read the file.
drop policy if exists "ticket_attachments_read" on storage.objects;
create policy "ticket_attachments_read"
  on storage.objects for select
  using (
    bucket_id = 'ticket-attachments'
    and public.is_workspace_member(public.storage_workspace_id_from_path(name))
  );

-- Insert: any member of the workspace can upload, as long as the path
-- prefix matches a workspace they belong to.
drop policy if exists "ticket_attachments_insert" on storage.objects;
create policy "ticket_attachments_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'ticket-attachments'
    and public.is_workspace_member(public.storage_workspace_id_from_path(name))
  );

-- Delete: owners of the workspace can clean up. (Service role bypasses RLS.)
drop policy if exists "ticket_attachments_delete" on storage.objects;
create policy "ticket_attachments_delete"
  on storage.objects for delete
  using (
    bucket_id = 'ticket-attachments'
    and public.is_workspace_owner(public.storage_workspace_id_from_path(name))
  );
