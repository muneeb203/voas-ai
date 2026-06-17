-- VOAS AI - multilingual voice agent support.
-- Adds a `language` column to voice_settings so each workspace picks the
-- language its calls happen in (English / Arabic / Urdu in v1). The Vapi
-- assistant sync uses this to pick STT model, TTS model, and which default
-- system prompt + greeting to seed.

alter table public.voice_settings
  add column language text not null default 'en';

alter table public.voice_settings
  add constraint voice_settings_language_check
  check (language in ('en', 'ar', 'ur'));

comment on column public.voice_settings.language is
  'ISO 639-1 code. Drives Deepgram STT language + ElevenLabs TTS model + default prompt/greeting.';
