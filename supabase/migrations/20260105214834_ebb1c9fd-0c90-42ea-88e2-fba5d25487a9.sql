-- Add unique constraint to prevent duplicate blocked dates/times
CREATE UNIQUE INDEX IF NOT EXISTS blocked_dates_unique_idx 
ON public.blocked_dates (blocked_date, COALESCE(blocked_time, '00:00:00'::time));