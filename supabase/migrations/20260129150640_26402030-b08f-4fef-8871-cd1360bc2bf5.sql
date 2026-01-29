-- Create a function to recalculate blocked slots when additional services are added
CREATE OR REPLACE FUNCTION public.recalculate_blocked_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  appointment_record RECORD;
  total_duration integer;
  required_slots integer;
  slot_offset integer;
  time_to_block time;
  hours_part integer;
  mins_part integer;
BEGIN
  -- Get the appointment details
  SELECT a.*, s.duration_minutes as main_duration
  INTO appointment_record
  FROM appointments a
  JOIN services s ON a.service_id = s.id
  WHERE a.id = NEW.appointment_id;

  -- Only proceed if appointment exists and is not cancelled
  IF appointment_record IS NULL OR appointment_record.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- Calculate total duration including all additional services
  SELECT 
    COALESCE(appointment_record.main_duration, 30) + 
    COALESCE(SUM(s.duration_minutes), 0)
  INTO total_duration
  FROM appointment_services aps 
  JOIN services s ON aps.service_id = s.id 
  WHERE aps.appointment_id = NEW.appointment_id;

  -- Calculate required 30-minute slots
  required_slots := CEIL(total_duration::numeric / 30);

  -- Block all required time slots
  FOR slot_offset IN 0..(required_slots - 1) LOOP
    hours_part := EXTRACT(HOUR FROM appointment_record.appointment_time)::integer;
    mins_part := EXTRACT(MINUTE FROM appointment_record.appointment_time)::integer + (slot_offset * 30);
    hours_part := hours_part + (mins_part / 60);
    mins_part := mins_part % 60;
    time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
    
    INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
    VALUES (appointment_record.appointment_date, time_to_block, 'Horário reservado')
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Create trigger on appointment_services to recalculate blocks when services are added
CREATE TRIGGER recalculate_blocked_slots_on_service_add
  AFTER INSERT ON public.appointment_services
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_blocked_slots();