ALTER TABLE public.subscription_progress
ADD COLUMN IF NOT EXISTS expired_weeks_this_period integer NOT NULL DEFAULT 0;