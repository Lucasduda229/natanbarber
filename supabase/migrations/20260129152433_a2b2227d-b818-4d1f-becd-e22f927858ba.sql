
-- Fix the block_time_on_appointment function to correctly unblock all consecutive slots on cancellation
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
  record_for_duration RECORD;
BEGIN
  -- For unblocking (DELETE or cancellation), we need to use OLD record
  -- For blocking (INSERT or non-cancelled UPDATE), we use NEW record
  
  -- Handle DELETE operation - unblock all slots
  IF TG_OP = 'DELETE' THEN
    -- Calculate total duration using OLD record
    SELECT 
      COALESCE(s.duration_minutes, 30) + 
      COALESCE(
        (SELECT SUM(s2.duration_minutes) 
         FROM appointment_services aps 
         JOIN services s2 ON aps.service_id = s2.id 
         WHERE aps.appointment_id = OLD.id), 
        0
      )
    INTO total_duration
    FROM services s
    WHERE s.id = OLD.service_id;

    IF total_duration IS NULL THEN
      total_duration := 30;
    END IF;

    required_slots := CEIL(total_duration::numeric / 30);

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

  -- Handle UPDATE operation
  IF TG_OP = 'UPDATE' THEN
    -- If status changes to cancelled, unblock all slots using OLD record for calculation
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      -- Calculate duration from OLD record (the original appointment)
      SELECT 
        COALESCE(s.duration_minutes, 30) + 
        COALESCE(
          (SELECT SUM(s2.duration_minutes) 
           FROM appointment_services aps 
           JOIN services s2 ON aps.service_id = s2.id 
           WHERE aps.appointment_id = OLD.id), 
          0
        )
      INTO total_duration
      FROM services s
      WHERE s.id = OLD.service_id;

      IF total_duration IS NULL THEN
        total_duration := 30;
      END IF;

      required_slots := CEIL(total_duration::numeric / 30);

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
    
    RETURN NEW;
  END IF;

  -- Handle INSERT operation - block all required slots
  IF TG_OP = 'INSERT' THEN
    SELECT 
      COALESCE(s.duration_minutes, 30) + 
      COALESCE(
        (SELECT SUM(s2.duration_minutes) 
         FROM appointment_services aps 
         JOIN services s2 ON aps.service_id = s2.id 
         WHERE aps.appointment_id = NEW.id), 
        0
      )
    INTO total_duration
    FROM services s
    WHERE s.id = NEW.service_id;

    IF total_duration IS NULL THEN
      total_duration := 30;
    END IF;

    required_slots := CEIL(total_duration::numeric / 30);

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
    
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;
