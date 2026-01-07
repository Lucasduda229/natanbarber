-- Create function to auto-add client to subscription when payment is confirmed
CREATE OR REPLACE FUNCTION public.auto_add_subscription_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      -- Create new subscription for the user
      INSERT INTO subscription_progress (
        user_id,
        subscription_start_date,
        consecutive_months,
        last_payment_date,
        is_active
      ) VALUES (
        NEW.user_id,
        CURRENT_DATE,
        1,
        CURRENT_DATE,
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS on_payment_confirmed_add_subscription ON appointments;
CREATE TRIGGER on_payment_confirmed_add_subscription
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_subscription_on_payment();