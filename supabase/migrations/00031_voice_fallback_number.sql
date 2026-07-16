-- Fallback number: where the voice agent hands a caller who asks for a human.
--
-- Deliberately its own field rather than reusing locations.phone — that's often
-- the very line the AI is answering, which would transfer the call straight back
-- to itself. Owners usually want a manager's mobile or a back-office line here.
--
-- Empty/null means no transfer target: the transferCall tool simply isn't
-- attached to the assistant and the agent behaves exactly as it does today.
-- Stored in E.164 (+14155551234) because that's what Vapi requires.

alter table public.voice_settings
  add column if not exists fallback_phone_number text;
