-- Update the trigger function to set weekly_credits_available when subscription is created
CREATE OR REPLACE FUNCTION public.auto_add_subscription_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_monthly_limit integer := 4; -- default
BEGIN
  -- Only act when payment_status changes to 'paid'
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid') THEN
    -- Check if user already has a subscription
    IF EXISTS (SELECT 1 FROM subscription_progress WHERE user_id = NEW.user_id) THEN
      -- Update existing subscription: increment months and update last payment date
      UPDATE subscription_progress
      SET 
        consecutive_months = consecutive_months + 1,
        last_payment_date = CURRENT_DATE,
        is_active = true,
        weekly_credits_available = CEIL(monthly_cuts_limit::numeric / 4),
        current_week_start = CURRENT_DATE,
        credits_expired_this_month = 0,
        updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      -- Create new subscription for the user
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
        CEIL(v_monthly_limit::numeric / 4),
        CURRENT_DATE,
        0
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Also fix any existing subscriptions that have 0 weekly credits
UPDATE subscription_progress 
SET weekly_credits_available = CEIL(monthly_cuts_limit::numeric / 4)
WHERE is_active = true AND weekly_credits_available = 0;