-- Real per-call cost, straight from Vapi's end-of-call-report.
--
-- Vapi computes what each call actually cost and splits it by component
-- (STT / LLM / TTS / platform fee / transport). We were discarding that. Storing
-- it gives us ground-truth unit economics per business — real cost per call and
-- per minute — instead of estimating from provider rate cards.
--
-- cost_usd is the total Vapi reported; cost_breakdown keeps the raw split so we
-- can see which component dominates without another API call.

alter table public.conversations
  add column if not exists cost_usd numeric,
  add column if not exists cost_breakdown jsonb;
