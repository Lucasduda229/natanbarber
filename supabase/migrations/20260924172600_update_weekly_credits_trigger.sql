CREATE OR REPLACE FUNCTION public.auto_add_subscription_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_monthly_limit integer := 4;
  v_package_weekly_credits integer := NULL;
  v_weekly_credits integer;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    
    -- Try to fetch weekly_credits from the package if package_id is present
    IF NEW.package_id IS NOT NULL THEN
      SELECT weekly_credits INTO v_package_weekly_credits FROM packages WHERE id = NEW.package_id;
    END IF;

    -- Compute the weekly credits to use
    IF v_package_weekly_credits IS NOT NULL THEN
      v_weekly_credits := v_package_weekly_credits;
    ELSE
      v_weekly_credits := CEIL(v_monthly_limit::numeric / 4);
    END IF;

    IF EXISTS (SELECT 1 FROM subscription_progress WHERE user_id = NEW.user_id) THEN
      UPDATE subscription_progress
      SET 
        consecutive_months = consecutive_months + 1,
        last_payment_date = CURRENT_DATE,
        is_active = true,
        weekly_credits_available = v_weekly_credits,
        current_week_start = CURRENT_DATE,
        credits_expired_this_month = 0,
        updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      INSERT INTO subscription_progress (
        user_id,
        subscription_start_date,
        consecutive_months,
        last_payment_date,
        is_active,
        monthly_cuts_limit,
        weekly_credits_available,
        current_week_start,
        credits_expired_this_month
      ) VALUES (
        NEW.user_id,
        CURRENT_DATE,
        1,
        CURRENT_DATE,
        true,
        v_monthly_limit,
        v_weekly_credits,
        CURRENT_DATE,
        0
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
