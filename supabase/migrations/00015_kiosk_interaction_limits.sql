-- Add monthly interaction limit tracking to workspace_kiosk_settings
ALTER TABLE workspace_kiosk_settings
  ADD COLUMN kiosk_monthly_limit integer NOT NULL DEFAULT 500,
  ADD COLUMN kiosk_credits_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN kiosk_credits_used_this_month integer NOT NULL DEFAULT 0,
  ADD COLUMN kiosk_month_start timestamptz;

-- Atomic credit decrement with lazy monthly reset (subscription anniversary model).
-- Returns jsonb: {success, reason?, balance?, unlimited?}
-- 0 monthly_limit = unlimited (Enterprise/custom).
-- month_start NULL = not yet activated by admin — treated as limit reached.
CREATE OR REPLACE FUNCTION decrement_kiosk_credit(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance              integer;
  v_monthly_limit        integer;
  v_month_start          timestamptz;
  v_new_month_start      timestamptz;
  v_months_rolled        integer := 0;
BEGIN
  SELECT kiosk_credits_balance, kiosk_monthly_limit, kiosk_month_start
    INTO v_balance, v_monthly_limit, v_month_start
    FROM workspace_kiosk_settings
   WHERE workspace_id = p_workspace_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'NO_SETTINGS');
  END IF;

  -- 0 = unlimited (Enterprise / custom deal)
  IF v_monthly_limit = 0 THEN
    RETURN jsonb_build_object('success', true, 'unlimited', true);
  END IF;

  -- Not yet activated by admin
  IF v_month_start IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'KIOSK_LIMIT_REACHED', 'balance', 0);
  END IF;

  -- Lazy monthly reset: add monthly_limit for each full month elapsed since month_start
  v_new_month_start := v_month_start;
  WHILE v_new_month_start + interval '1 month' <= now() LOOP
    v_new_month_start := v_new_month_start + interval '1 month';
    v_balance         := v_balance + v_monthly_limit;
    v_months_rolled   := v_months_rolled + 1;
  END LOOP;

  IF v_months_rolled > 0 THEN
    UPDATE workspace_kiosk_settings
       SET kiosk_credits_balance        = v_balance,
           kiosk_credits_used_this_month = 0,
           kiosk_month_start            = v_new_month_start,
           updated_at                   = now()
     WHERE workspace_id = p_workspace_id;
  END IF;

  -- Hard stop when balance is exhausted
  IF v_balance <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'KIOSK_LIMIT_REACHED', 'balance', v_balance);
  END IF;

  -- Consume one credit
  UPDATE workspace_kiosk_settings
     SET kiosk_credits_balance         = kiosk_credits_balance - 1,
         kiosk_credits_used_this_month = kiosk_credits_used_this_month + 1,
         updated_at                    = now()
   WHERE workspace_id = p_workspace_id;

  RETURN jsonb_build_object('success', true, 'balance', v_balance - 1);
END;
$$;
