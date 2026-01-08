-- Update the use_subscription_cut function to reduce weekly credits
CREATE OR REPLACE FUNCTION public.use_subscription_cut(p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription subscription_progress%ROWTYPE;
BEGIN
  -- Get user's active subscription
  SELECT * INTO v_subscription
  FROM subscription_progress
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Check if subscription exists
  IF v_subscription.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if has remaining weekly credits
  IF v_subscription.weekly_credits_available <= 0 THEN
    RETURN false;
  END IF;
  
  -- Reset monthly if new month
  IF v_subscription.current_month_start IS NULL OR 
     EXTRACT(MONTH FROM v_subscription.current_month_start) != EXTRACT(MONTH FROM CURRENT_DATE) OR
     EXTRACT(YEAR FROM v_subscription.current_month_start) != EXTRACT(YEAR FROM CURRENT_DATE) THEN
    UPDATE subscription_progress
    SET cuts_used_this_month = 1,
        weekly_credits_available = weekly_credits_available - 1,
        current_month_start = DATE_TRUNC('month', CURRENT_DATE)::date,
        updated_at = now()
    WHERE id = v_subscription.id;
    RETURN true;
  END IF;
  
  -- Use a cut - reduce weekly credits
  UPDATE subscription_progress
  SET cuts_used_this_month = cuts_used_this_month + 1,
      weekly_credits_available = weekly_credits_available - 1,
      updated_at = now()
  WHERE id = v_subscription.id;
  
  RETURN true;
END;
$function$;