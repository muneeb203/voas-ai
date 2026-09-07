-- Per-workspace display currency. Amounts are stored as minor units (cents)
-- exactly as before — this only changes the symbol and decimal formatting shown
-- to owners and customers. No conversion happens.

alter table public.workspaces
  add column if not exists currency text not null default 'USD';
