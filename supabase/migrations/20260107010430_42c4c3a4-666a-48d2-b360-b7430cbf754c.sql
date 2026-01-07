-- Create trigger to notify admins when a new subscription is purchased
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
  customer_name text;
  package_name_text text;
BEGIN
  -- Get customer name
  SELECT full_name INTO customer_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Get package name
  package_name_text := COALESCE(NEW.package_name, 'Assinatura');
  
  -- Notify all admins
  FOR admin_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type
    ) VALUES (
      admin_user_id,
      'Nova Assinatura!',
      COALESCE(customer_name, 'Cliente') || ' comprou o pacote ' || package_name_text,
      'new_subscription'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new subscriptions
DROP TRIGGER IF EXISTS on_new_subscription_notify_admin ON public.subscription_progress;
CREATE TRIGGER on_new_subscription_notify_admin
  AFTER INSERT ON public.subscription_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_subscription();