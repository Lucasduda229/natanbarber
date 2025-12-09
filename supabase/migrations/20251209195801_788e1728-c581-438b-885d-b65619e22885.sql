-- Create a function to notify admin on new appointments
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  admin_user_id uuid;
  customer_name text;
  service_name text;
BEGIN
  -- Get customer name
  SELECT full_name INTO customer_name FROM public.profiles WHERE user_id = NEW.user_id;
  
  -- Get service name
  SELECT name INTO service_name FROM public.services WHERE id = NEW.service_id;
  
  -- Notify all admins
  FOR admin_user_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      appointment_id
    ) VALUES (
      admin_user_id,
      'Novo Agendamento',
      'Novo pedido de ' || COALESCE(customer_name, 'Cliente') || ' para ' || COALESCE(service_name, 'serviço') || ' em ' || to_char(NEW.appointment_date, 'DD/MM') || ' às ' || to_char(NEW.appointment_time, 'HH24:MI'),
      'new_booking',
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new appointments
DROP TRIGGER IF EXISTS on_new_appointment_notify_admin ON public.appointments;
CREATE TRIGGER on_new_appointment_notify_admin
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_appointment();