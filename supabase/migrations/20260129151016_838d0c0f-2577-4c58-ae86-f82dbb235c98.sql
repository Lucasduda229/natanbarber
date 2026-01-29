-- Update the block_time_on_appointment function to properly unblock all consecutive slots on cancellation
CREATE OR REPLACE FUNCTION public.block_time_on_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_duration integer;
  required_slots integer;
  slot_offset integer;
  time_to_block time;
  hours_part integer;
  mins_part integer;
  target_record RECORD;
BEGIN
  -- Determine which record to use (NEW for insert/update, OLD for delete)
  IF TG_OP = 'DELETE' THEN
    target_record := OLD;
  ELSE
    target_record := NEW;
  END IF;

  -- Calculate total duration from main service + additional services
  SELECT 
    COALESCE(s.duration_minutes, 30) + 
    COALESCE(
      (SELECT SUM(s2.duration_minutes) 
       FROM appointment_services aps 
       JOIN services s2 ON aps.service_id = s2.id 
       WHERE aps.appointment_id = target_record.id), 
      0
    )
  INTO total_duration
  FROM services s
  WHERE s.id = target_record.service_id;

  -- If no duration found, default to 30
  IF total_duration IS NULL THEN
    total_duration := 30;
  END IF;

  -- Calculate required 30-minute slots
  required_slots := CEIL(total_duration::numeric / 30);

  -- On INSERT or UPDATE to non-cancelled status, block all required time slots
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status != 'cancelled') THEN
    FOR slot_offset IN 0..(required_slots - 1) LOOP
      hours_part := EXTRACT(HOUR FROM NEW.appointment_time)::integer;
      mins_part := EXTRACT(MINUTE FROM NEW.appointment_time)::integer + (slot_offset * 30);
      hours_part := hours_part + (mins_part / 60);
      mins_part := mins_part % 60;
      time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
      
      INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
      VALUES (NEW.appointment_date, time_to_block, 'Horário reservado')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- On UPDATE: if status changes to cancelled, unblock ALL consecutive time slots
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    FOR slot_offset IN 0..(required_slots - 1) LOOP
      hours_part := EXTRACT(HOUR FROM OLD.appointment_time)::integer;
      mins_part := EXTRACT(MINUTE FROM OLD.appointment_time)::integer + (slot_offset * 30);
      hours_part := hours_part + (mins_part / 60);
      mins_part := mins_part % 60;
      time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
      
      DELETE FROM public.blocked_dates 
      WHERE blocked_date = OLD.appointment_date 
        AND blocked_time = time_to_block;
    END LOOP;
  END IF;

  -- On DELETE: unblock all the consecutive time slots
  IF TG_OP = 'DELETE' THEN
    FOR slot_offset IN 0..(required_slots - 1) LOOP
      hours_part := EXTRACT(HOUR FROM OLD.appointment_time)::integer;
      mins_part := EXTRACT(MINUTE FROM OLD.appointment_time)::integer + (slot_offset * 30);
      hours_part := hours_part + (mins_part / 60);
      mins_part := mins_part % 60;
      time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
      
      DELETE FROM public.blocked_dates 
      WHERE blocked_date = OLD.appointment_date 
        AND blocked_time = time_to_block;
    END LOOP;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;