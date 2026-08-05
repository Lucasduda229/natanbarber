-- Update process_referral function to support name-phone format
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
        v_last_4_phone := right(p_referrer_code, 4);
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
        IF NOT EXISTS (SELECT 1 FROM public.referral_history WHERE referred_id = p_referred_id) THEN
            INSERT INTO public.referral_history (referrer_id, referred_id)
            VALUES (v_referrer_id, p_referred_id);
            
            RETURN TRUE;
        END IF;
    END IF;
    
    RETURN FALSE;
END;
$$;
