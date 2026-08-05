-- 1. Create table for store products
CREATE TABLE IF NOT EXISTS public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    image_url TEXT,
    cost_in_tickets INTEGER NOT NULL CHECK (cost_in_tickets > 0),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create table for redemptions
CREATE TABLE IF NOT EXISTS public.store_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.store_products(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_redemptions ENABLE ROW LEVEL SECURITY;

-- Policies for Store Products
CREATE POLICY "Anyone can view active store products" 
ON public.store_products FOR SELECT 
USING (active = true);

-- Policies for Store Redemptions
CREATE POLICY "Users can view their own store redemptions" 
ON public.store_redemptions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own store redemptions" 
ON public.store_redemptions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. Stored Procedure to redeem a store product safely
CREATE OR REPLACE FUNCTION redeem_store_product(p_user_id UUID, p_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER;
    v_balance INTEGER;
BEGIN
    -- Get product cost
    SELECT cost_in_tickets INTO v_cost 
    FROM public.store_products 
    WHERE id = p_product_id AND active = true;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto não encontrado ou inativo.';
    END IF;

    -- Get user tickets balance
    SELECT tickets_balance INTO v_balance 
    FROM public.profiles 
    WHERE user_id = p_user_id;

    IF v_balance < v_cost THEN
        RAISE EXCEPTION 'Tickets insuficientes.';
    END IF;

    -- Deduct balance
    UPDATE public.profiles 
    SET tickets_balance = tickets_balance - v_cost 
    WHERE user_id = p_user_id;

    -- Insert redemption
    INSERT INTO public.store_redemptions (user_id, product_id, status)
    VALUES (p_user_id, p_product_id, 'pending');

    RETURN TRUE;
END;
$$;

-- Create storage bucket for product images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'products');
CREATE POLICY "Admin Insert Access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'products');
CREATE POLICY "Admin Update Access" ON storage.objects FOR UPDATE USING (bucket_id = 'products');
CREATE POLICY "Admin Delete Access" ON storage.objects FOR DELETE USING (bucket_id = 'products');
