-- Allow configuring a custom weekly credits limit per subscriber (overrides packages.weekly_credits)
ALTER TABLE public.subscription_progress
ADD COLUMN IF NOT EXISTS weekly_credits_limit integer NULL;

COMMENT ON COLUMN public.subscription_progress.weekly_credits_limit
IS 'Optional per-subscriber weekly booking limit override; when NULL, falls back to packages.weekly_credits or default 1.';
