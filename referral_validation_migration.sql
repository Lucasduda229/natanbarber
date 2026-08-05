-- 1. Add is_valid column to referral_history
ALTER TABLE public.referral_history
ADD COLUMN IF NOT EXISTS is_valid BOOLEAN DEFAULT false;

-- 2. Mark existing history as valid so older users don't lose anything
UPDATE public.referral_history
SET is_valid = true
WHERE is_valid = false;

-- 3. Update the process_referral function to only insert the history (without giving points)
DROP FUNCTION IF EXISTS process_referral(text, uuid);
CREATE OR REPLACE FUNCTION process_referral(p_referrer_code TEXT, p_referred_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
    v_first_name TEXT;
    v_last_4_phone TEXT;
BEGIN
    -- 1. First try to find by exact referral_code (UUID)
    SELECT user_id INTO v_referrer_id 
    FROM public.profiles 
    WHERE referral_code = p_referrer_code;

    -- 2. If not found and code contains a hyphen, try to parse as name-phone (e.g., lucas-5303)
    IF NOT FOUND AND p_referrer_code LIKE '%-%' THEN
        -- Split from the right to get the last part (phone digits)
        v_last_4_phone := right(p_referrer_code, 4);
        -- Get the name part (everything before the last 4 digits and the hyphen)
        v_first_name := left(p_referrer_code, length(p_referrer_code) - 5);
        
        SELECT user_id INTO v_referrer_id 
        FROM public.profiles 
        WHERE (
            lower(translate(split_part(full_name, ' ', 1), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')) = lower(v_first_name)
        ) AND (
            phone LIKE '%' || v_last_4_phone
        )
        LIMIT 1;
    END IF;

    IF FOUND AND v_referrer_id != p_referred_id THEN
        -- Check if a referral already exists for this referred user
        IF NOT EXISTS (SELECT 1 FROM public.referral_history WHERE referred_id = p_referred_id) THEN
            -- Insert referral (will default to is_valid = false)
            INSERT INTO public.referral_history (referrer_id, referred_id)
            VALUES (v_referrer_id, p_referred_id);
            
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- 4. Create the new validate_referral function
CREATE OR REPLACE FUNCTION validate_referral(p_referred_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history_id UUID;
    v_referrer_id UUID;
BEGIN
    -- Look for a pending referral for this user
    SELECT id, referrer_id INTO v_history_id, v_referrer_id
    FROM public.referral_history
    WHERE referred_id = p_referred_id AND is_valid = false
    LIMIT 1;

    -- If found, validate it and grant rewards to the referrer
    IF FOUND THEN
        -- Mark as valid
        UPDATE public.referral_history
        SET is_valid = true
        WHERE id = v_history_id;

        -- Update referrer's balances (1 total, 1 balance, 2 tickets)
        UPDATE public.profiles
        SET 
            total_referrals = COALESCE(total_referrals, 0) + 1,
            referrals_balance = COALESCE(referrals_balance, 0) + 1,
            tickets_balance = COALESCE(tickets_balance, 0) + 2
        WHERE user_id = v_referrer_id;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;
