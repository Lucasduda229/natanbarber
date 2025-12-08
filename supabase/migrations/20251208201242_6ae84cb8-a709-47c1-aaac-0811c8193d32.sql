-- Create a function to automatically block the time slot when an appointment is confirmed
CREATE OR REPLACE FUNCTION public.block_time_on_appointment_confirm()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Insert into blocked_dates if not already blocked
    INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
    VALUES (
      NEW.appointment_date::text,
      NEW.appointment_time::text,
      'Agendamento confirmado automaticamente'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- If status changes FROM confirmed to something else (like cancelled), unblock the time
  IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    DELETE FROM public.blocked_dates 
    WHERE blocked_date = NEW.appointment_date::text 
      AND blocked_time = NEW.appointment_time::text
      AND reason = 'Agendamento confirmado automaticamente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to call the function on appointment updates
DROP TRIGGER IF EXISTS trigger_block_time_on_confirm ON public.appointments;
CREATE TRIGGER trigger_block_time_on_confirm
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.block_time_on_appointment_confirm();