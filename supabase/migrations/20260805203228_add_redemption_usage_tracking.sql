-- 1. Add columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS used_referral_redemption_id UUID REFERENCES public.referral_redemptions(id) ON DELETE SET NULL;

ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS used_store_redemption_id UUID REFERENCES public.store_redemptions(id) ON DELETE SET NULL;

-- 2. Update referral_redemptions constraint to include 'used'
ALTER TABLE public.referral_redemptions DROP CONSTRAINT IF EXISTS referral_redemptions_status_check;

ALTER TABLE public.referral_redemptions ADD CONSTRAINT referral_redemptions_status_check 
CHECK (status IN ('pending', 'completed', 'rejected', 'used'));
