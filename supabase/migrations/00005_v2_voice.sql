-- VOAS AI — V2 Sprint 2 voice integration schema.
-- Adds workspace-level Vapi assistant config + per-location Twilio config.

------------------------------------------------------------
-- voice_settings (one row per workspace)
------------------------------------------------------------

create table public.voice_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  vapi_assistant_id text,                          -- Vapi-side id after sync; null until first save
  system_prompt text not null default '',
  greeting text not null default 'Hi, thanks for calling. How can I help today?',
  voice text not null default 'rachel',           -- Vapi voice id (11labs voice)
  model text not null default 'gpt-4o-mini',      -- LLM the agent uses
  end_call_phrases text[],                        -- e.g. ['goodbye', 'thanks bye']
  enabled boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_voice_settings_updated_at
  before update on public.voice_settings
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- location_voice_config (one row per location, null = not configured)
------------------------------------------------------------

create table public.location_voice_config (
  location_id uuid primary key references public.locations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  twilio_account_sid text not null,
  twilio_auth_token text not null,                -- TODO: encrypt at rest before customer launch
  twilio_phone_number text not null,              -- E.164 format, e.g. +14155551234
  vapi_phone_number_id text,                      -- Vapi-side id after import
  enabled boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_location_voice_workspace on public.location_voice_config(workspace_id);

create trigger trg_location_voice_updated_at
  before update on public.location_voice_config
  for each row execute function public.set_updated_at();

------------------------------------------------------------
-- RLS
------------------------------------------------------------

alter table public.voice_settings enable row level security;
alter table public.location_voice_config enable row level security;

create policy "members read voice settings"
  on public.voice_settings for select using (public.is_workspace_member(workspace_id));

create policy "owners manage voice settings"
  on public.voice_settings for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "members read location voice"
  on public.location_voice_config for select using (public.is_workspace_member(workspace_id));

create policy "owners manage location voice"
  on public.location_voice_config for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));
