-- 1. Create table for referrals
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(referred_id) -- A user can only be referred once
);

-- 2. Add coupons_balance and referral_code to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS coupons_balance INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Generate referral codes for existing users
UPDATE public.profiles 
SET referral_code = substr(user_id::text, 1, 8) 
WHERE referral_code IS NULL;

-- 3. Create table for rewards
CREATE TABLE IF NOT EXISTS public.referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cost_in_coupons INTEGER NOT NULL CHECK (cost_in_coupons > 0),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create table for redemptions
CREATE TABLE IF NOT EXISTS public.referral_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES public.referral_rewards(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies for Referrals
CREATE POLICY "Users can view their own referrals" 
ON public.referrals FOR SELECT 
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can create a referral when they sign up" 
ON public.referrals FOR INSERT 
WITH CHECK (auth.uid() = referred_id);

-- Policies for Referral Rewards
CREATE POLICY "Anyone can view active rewards" 
ON public.referral_rewards FOR SELECT 
USING (active = true);

-- Policies for Referral Redemptions
CREATE POLICY "Users can view their own redemptions" 
ON public.referral_redemptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own redemptions" 
ON public.referral_redemptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- We need a secure function to handle redemption logic to avoid race conditions
CREATE OR REPLACE FUNCTION redeem_reward(p_user_id UUID, p_reward_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER;
    v_balance INTEGER;
BEGIN
    -- Get reward cost
    SELECT cost_in_coupons INTO v_cost 
    FROM public.referral_rewards 
    WHERE id = p_reward_id AND active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Prêmio não encontrado ou inativo.';
    END IF;

    -- Get user balance
    SELECT coupons_balance INTO v_balance 
    FROM public.profiles 
    WHERE user_id = p_user_id;

    IF v_balance < v_cost THEN
        RAISE EXCEPTION 'Saldo insuficiente.';
    END IF;

    -- Deduct balance
    UPDATE public.profiles 
    SET coupons_balance = coupons_balance - v_cost 
    WHERE user_id = p_user_id;

    -- Insert redemption
    INSERT INTO public.referral_redemptions (user_id, reward_id, status)
    VALUES (p_user_id, p_reward_id, 'pending');

    RETURN TRUE;
END;
$$;

-- Secure function to handle referrals at registration
CREATE OR REPLACE FUNCTION process_referral(p_referrer_code TEXT, p_referred_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
BEGIN
    -- Find referrer by code
    SELECT user_id INTO v_referrer_id 
    FROM public.profiles 
    WHERE referral_code = p_referrer_code;

    IF FOUND AND v_referrer_id != p_referred_id THEN
        -- Check if a referral already exists for this referred user
        IF NOT EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = p_referred_id) THEN
            -- Insert referral
            INSERT INTO public.referrals (referrer_id, referred_id)
            VALUES (v_referrer_id, p_referred_id);

            -- Increment referrer's balance
            UPDATE public.profiles 
            SET coupons_balance = coupons_balance + 1 
            WHERE user_id = v_referrer_id;
            
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$;
