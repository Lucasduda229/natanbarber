-- Create a unique partial index to prevent duplicate appointments at same date/time
-- Excludes cancelled appointments
CREATE UNIQUE INDEX IF NOT EXISTS appointments_unique_slot_idx 
ON public.appointments (appointment_date, appointment_time)
WHERE status NOT IN ('cancelled');

-- Update trigger to also block on INSERT (pending status), not just on confirm
CREATE OR REPLACE FUNCTION public.block_time_on_appointment()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT or UPDATE to non-cancelled status, block the time
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status != 'cancelled') THEN
    INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
    VALUES (
      NEW.appointment_date,
      NEW.appointment_time,
      'Horário reservado'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- On UPDATE: if status changes to cancelled, unblock the time
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    DELETE FROM public.blocked_dates 
    WHERE blocked_date = NEW.appointment_date 
      AND blocked_time = NEW.appointment_time;
  END IF;
  
  -- On DELETE: unblock the time
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.blocked_dates 
    WHERE blocked_date = OLD.appointment_date 
      AND blocked_time = OLD.appointment_time;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger
DROP TRIGGER IF EXISTS trigger_block_time_on_confirm ON public.appointments;

-- Create new triggers for INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS trigger_block_time_on_appointment_insert ON public.appointments;
DROP TRIGGER IF EXISTS trigger_block_time_on_appointment_update ON public.appointments;
DROP TRIGGER IF EXISTS trigger_block_time_on_appointment_delete ON public.appointments;

CREATE TRIGGER trigger_block_time_on_appointment_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.block_time_on_appointment();

CREATE TRIGGER trigger_block_time_on_appointment_update
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.block_time_on_appointment();

CREATE TRIGGER trigger_block_time_on_appointment_delete
  AFTER DELETE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.block_time_on_appointment();