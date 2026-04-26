CREATE OR REPLACE FUNCTION public.notify_admin_on_new_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_user_id uuid;
  customer_name text;
  package_name_text text;
BEGIN
  -- Get customer name
  SELECT full_name INTO customer_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Get package name - try column first, then fallback to packages table via package_id
  package_name_text := NEW.package_name;
  
  IF package_name_text IS NULL OR package_name_text = '' THEN
    SELECT name INTO package_name_text FROM public.packages WHERE id = NEW.package_id;
  END IF;
  
  IF package_name_text IS NULL OR package_name_text = '' THEN
    package_name_text := 'Pacote VIP';
  END IF;
  
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
$function$;