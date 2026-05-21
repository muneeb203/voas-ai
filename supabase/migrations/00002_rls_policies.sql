-- VOAS AI — Row Level Security policies.
-- Every table has RLS enabled. The service role (used by FastAPI) bypasses
-- RLS; the anon/authenticated keys (used by the frontend) are constrained
-- to these policies. See CLAUDE.md §4.3.

------------------------------------------------------------
-- helper: am I a member of this workspace?
------------------------------------------------------------

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

------------------------------------------------------------
-- workspaces
------------------------------------------------------------

alter table public.workspaces enable row level security;

create policy "members read own workspace"
  on public.workspaces for select
  using (public.is_workspace_member(id));

create policy "owners update own workspace"
  on public.workspaces for update
  using (public.is_workspace_owner(id))
  with check (public.is_workspace_owner(id));

------------------------------------------------------------
-- workspace_members
------------------------------------------------------------

alter table public.workspace_members enable row level security;

create policy "members read workspace members"
  on public.workspace_members for select
  using (public.is_workspace_member(workspace_id));

create policy "owners manage workspace members"
  on public.workspace_members for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

------------------------------------------------------------
-- locations
------------------------------------------------------------

alter table public.locations enable row level security;

create policy "members read locations"
  on public.locations for select
  using (public.is_workspace_member(workspace_id));

create policy "owners manage locations"
  on public.locations for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

------------------------------------------------------------
-- support_tickets
------------------------------------------------------------

alter table public.support_tickets enable row level security;

create policy "members read workspace tickets"
  on public.support_tickets for select
  using (public.is_workspace_member(workspace_id));

create policy "members create tickets in workspace"
  on public.support_tickets for insert
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

create policy "ticket creator updates own ticket"
  on public.support_tickets for update
  using (public.is_workspace_member(workspace_id) and created_by = auth.uid())
  with check (public.is_workspace_member(workspace_id));

------------------------------------------------------------
-- support_messages
------------------------------------------------------------

alter table public.support_messages enable row level security;

create policy "members read non-internal ticket messages"
  on public.support_messages for select
  using (
    is_internal_note = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and public.is_workspace_member(t.workspace_id)
    )
  );

create policy "members reply to tickets in workspace"
  on public.support_messages for insert
  with check (
    sender_type = 'user'
    and sender_id = auth.uid()
    and is_internal_note = false
    and exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and public.is_workspace_member(t.workspace_id)
    )
  );

------------------------------------------------------------
-- chat_sessions / chat_messages (deferred feature — lock down for now)
------------------------------------------------------------

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "members read workspace chat sessions"
  on public.chat_sessions for select
  using (public.is_workspace_member(workspace_id));

------------------------------------------------------------
-- admin_users — locked down. Only service role touches this.
------------------------------------------------------------

alter table public.admin_users enable row level security;

create policy "admin_users locked"
  on public.admin_users for all
  using (false)
  with check (false);

------------------------------------------------------------
-- audit_logs — readable by service role only. NO update/delete EVER.
------------------------------------------------------------

alter table public.audit_logs enable row level security;

create policy "audit_logs locked from clients"
  on public.audit_logs for all
  using (false)
  with check (false);

-- Defense in depth: hard-block update/delete on audit_logs at the row level.
-- Even a misconfigured policy can't bypass these no-op policies because
-- nothing satisfies `using (false)`. The service role still bypasses RLS,
-- so we additionally rely on application-level discipline (never UPDATE
-- or DELETE rows in this table — INSERT only).

------------------------------------------------------------
-- contact_submissions — public can INSERT (marketing form), nobody reads.
------------------------------------------------------------

alter table public.contact_submissions enable row level security;

create policy "anyone can submit contact form"
  on public.contact_submissions for insert
  with check (true);

------------------------------------------------------------
-- invitations
------------------------------------------------------------

alter table public.invitations enable row level security;

create policy "owners manage invitations"
  on public.invitations for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));
