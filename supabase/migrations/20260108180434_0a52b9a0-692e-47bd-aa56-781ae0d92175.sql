-- Change usage_reset_date to timestamp to track exact time of reset
ALTER TABLE public.subscription_progress 
ALTER COLUMN usage_reset_date TYPE timestamp with time zone
USING usage_reset_date::timestamp with time zone;