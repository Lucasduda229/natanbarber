-- Add monthly credits tracking to subscription_progress
ALTER TABLE public.subscription_progress 
ADD COLUMN IF NOT EXISTS monthly_cuts_limit integer NOT NULL DEFAULT 4,
ADD COLUMN IF NOT EXISTS cuts_used_this_month integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_month_start date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.packages(id),
ADD COLUMN IF NOT EXISTS package_name text;

-- Create function to reset monthly cuts at the start of each month
CREATE OR REPLACE FUNCTION public.check_and_reset_monthly_cuts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If it's a new month, reset the cuts counter
  IF NEW.current_month_start IS NULL OR 
     EXTRACT(MONTH FROM NEW.current_month_start) != EXTRACT(MONTH FROM CURRENT_DATE) OR
     EXTRACT(YEAR FROM NEW.current_month_start) != EXTRACT(YEAR FROM CURRENT_DATE) THEN
    NEW.cuts_used_this_month := 0;
    NEW.current_month_start := DATE_TRUNC('month', CURRENT_DATE)::date;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-reset monthly cuts
DROP TRIGGER IF EXISTS reset_monthly_cuts_trigger ON public.subscription_progress;
CREATE TRIGGER reset_monthly_cuts_trigger
BEFORE UPDATE ON public.subscription_progress
FOR EACH ROW
EXECUTE FUNCTION public.check_and_reset_monthly_cuts();

-- Create function to use a subscription cut when booking
CREATE OR REPLACE FUNCTION public.use_subscription_cut(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription subscription_progress%ROWTYPE;
BEGIN
  -- Get user's active subscription
  SELECT * INTO v_subscription
  FROM subscription_progress
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  -- Check if subscription exists and has credits
  IF v_subscription.id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Reset if new month
  IF v_subscription.current_month_start IS NULL OR 
     EXTRACT(MONTH FROM v_subscription.current_month_start) != EXTRACT(MONTH FROM CURRENT_DATE) OR
     EXTRACT(YEAR FROM v_subscription.current_month_start) != EXTRACT(YEAR FROM CURRENT_DATE) THEN
    UPDATE subscription_progress
    SET cuts_used_this_month = 1,
        current_month_start = DATE_TRUNC('month', CURRENT_DATE)::date,
        updated_at = now()
    WHERE id = v_subscription.id;
    RETURN true;
  END IF;
  
  -- Check if has remaining cuts
  IF v_subscription.cuts_used_this_month >= v_subscription.monthly_cuts_limit THEN
    RETURN false;
  END IF;
  
  -- Use a cut
  UPDATE subscription_progress
  SET cuts_used_this_month = cuts_used_this_month + 1,
      updated_at = now()
  WHERE id = v_subscription.id;
  
  RETURN true;
END;
$$;

-- Update existing subscriptions with package info based on price patterns
-- Bronze packages = 4 cuts, Prata = 4 cuts, Ouro = 4 cuts (with bonus for 5-week months)
COMMENT ON COLUMN subscription_progress.monthly_cuts_limit IS 'Number of free cuts allowed per month';