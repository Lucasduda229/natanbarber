-- Fix the trigger function to use proper date/time types instead of text
CREATE OR REPLACE FUNCTION public.block_time_on_appointment_confirm()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act when status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Insert into blocked_dates if not already blocked
    INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
    VALUES (
      NEW.appointment_date,
      NEW.appointment_time,
      'Agendamento confirmado automaticamente'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- If status changes FROM confirmed to something else (like cancelled), unblock the time
  IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
    DELETE FROM public.blocked_dates 
    WHERE blocked_date = NEW.appointment_date 
      AND blocked_time = NEW.appointment_time
      AND reason = 'Agendamento confirmado automaticamente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;