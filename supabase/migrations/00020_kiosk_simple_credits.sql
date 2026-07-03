-- Simplify the kiosk to a plain, stacking credit balance.
-- - Always available (no admin enable/disable, no monthly reset).
-- - New workspaces start with 10 credits; 1 credit is consumed per completed
--   order (not per conversation turn).
-- - Admins can only ADD credits (they stack onto the balance). 0 = inactive.

alter table workspace_kiosk_settings
  alter column kiosk_credits_balance set default 10,
  alter column kiosk_enabled set default true;

-- Every workspace gets a settings row, enabled, with at least 10 credits.
insert into workspace_kiosk_settings (workspace_id, kiosk_credits_balance, kiosk_enabled)
select w.id, 10, true
from workspaces w
where not exists (
  select 1 from workspace_kiosk_settings s where s.workspace_id = w.id
);

update workspace_kiosk_settings set kiosk_enabled = true where kiosk_enabled is distinct from true;
update workspace_kiosk_settings set kiosk_credits_balance = 10 where kiosk_credits_balance <= 0;

-- Consume one credit per completed order (floors at 0). Called only on order
-- confirmation now, not on every conversation turn.
create or replace function decrement_kiosk_credit(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_balance integer;
begin
  update workspace_kiosk_settings
     set kiosk_credits_balance         = greatest(0, kiosk_credits_balance - 1),
         kiosk_credits_used_this_month = kiosk_credits_used_this_month + 1,
         updated_at                    = now()
   where workspace_id = p_workspace_id
   returning kiosk_credits_balance into v_balance;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'NO_SETTINGS', 'balance', 0);
  end if;

  return jsonb_build_object('success', true, 'balance', v_balance);
end;
$$;
