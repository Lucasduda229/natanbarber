
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
  is_subscription boolean;
  service_count integer;
BEGIN
  -- Handle DELETE operation - unblock all slots
  IF TG_OP = 'DELETE' THEN
    is_subscription := (OLD.payment_method = 'subscription');
    
    IF is_subscription THEN
      -- Count total services (main + additional)
      SELECT 1 + COUNT(*) INTO service_count
      FROM appointment_services aps WHERE aps.appointment_id = OLD.id;
      
      -- 1-2 serviços = 30 min, 3+ serviços = 60 min
      IF service_count >= 3 THEN
        total_duration := 60;
      ELSE
        total_duration := 30;
      END IF;
    ELSE
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
      IF total_duration IS NULL THEN total_duration := 30; END IF;
    END IF;

    required_slots := CEIL(total_duration::numeric / 30);
    FOR slot_offset IN 0..(required_slots - 1) LOOP
      hours_part := EXTRACT(HOUR FROM OLD.appointment_time)::integer;
      mins_part := EXTRACT(MINUTE FROM OLD.appointment_time)::integer + (slot_offset * 30);
      hours_part := hours_part + (mins_part / 60);
      mins_part := mins_part % 60;
      time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
      DELETE FROM public.blocked_dates 
      WHERE blocked_date = OLD.appointment_date AND blocked_time = time_to_block;
    END LOOP;
    RETURN OLD;
  END IF;

  -- Handle UPDATE operation
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
      is_subscription := (OLD.payment_method = 'subscription');
      
      IF is_subscription THEN
        SELECT 1 + COUNT(*) INTO service_count
        FROM appointment_services aps WHERE aps.appointment_id = OLD.id;
        
        IF service_count >= 3 THEN
          total_duration := 60;
        ELSE
          total_duration := 30;
        END IF;
      ELSE
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
        IF total_duration IS NULL THEN total_duration := 30; END IF;
      END IF;

      required_slots := CEIL(total_duration::numeric / 30);
      FOR slot_offset IN 0..(required_slots - 1) LOOP
        hours_part := EXTRACT(HOUR FROM OLD.appointment_time)::integer;
        mins_part := EXTRACT(MINUTE FROM OLD.appointment_time)::integer + (slot_offset * 30);
        hours_part := hours_part + (mins_part / 60);
        mins_part := mins_part % 60;
        time_to_block := (hours_part || ':' || LPAD(mins_part::text, 2, '0') || ':00')::time;
        DELETE FROM public.blocked_dates 
        WHERE blocked_date = OLD.appointment_date AND blocked_time = time_to_block;
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle INSERT operation
  IF TG_OP = 'INSERT' THEN
    is_subscription := (NEW.payment_method = 'subscription');
    
    IF is_subscription THEN
      -- Count total services (main + additional)
      SELECT 1 + COUNT(*) INTO service_count
      FROM appointment_services aps WHERE aps.appointment_id = NEW.id;
      
      -- 1-2 serviços = 30 min, 3+ serviços = 60 min
      IF service_count >= 3 THEN
        total_duration := 60;
      ELSE
        total_duration := 30;
      END IF;
    ELSE
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
      IF total_duration IS NULL THEN total_duration := 30; END IF;
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
