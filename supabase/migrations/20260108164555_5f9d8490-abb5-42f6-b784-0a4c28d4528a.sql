-- Add weekly credits tracking to subscription_progress
ALTER TABLE public.subscription_progress
ADD COLUMN IF NOT EXISTS weekly_credits_available INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_week_start DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS credits_expired_this_month INTEGER DEFAULT 0;

-- Update existing subscriptions to have weekly credits based on their monthly limit
-- Assuming 4 weeks per month, each week gets 1/4 of monthly cuts
UPDATE public.subscription_progress
SET 
  weekly_credits_available = CEIL(monthly_cuts_limit::numeric / 4),
  current_week_start = DATE_TRUNC('week', CURRENT_DATE)::date
WHERE is_active = true;

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;