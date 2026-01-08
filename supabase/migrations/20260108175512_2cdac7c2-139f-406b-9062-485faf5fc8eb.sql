-- Add usage_reset_date column to track when benefits usage was last reset
ALTER TABLE public.subscription_progress 
ADD COLUMN IF NOT EXISTS usage_reset_date date DEFAULT CURRENT_DATE;