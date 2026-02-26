-- Create function to clean up old blocked dates
CREATE OR REPLACE FUNCTION public.cleanup_old_blocked_dates()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.blocked_dates
  WHERE blocked_date < CURRENT_DATE;
END;
$$;
