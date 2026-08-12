-- Allow admins to view ALL store products (including inactive)
CREATE POLICY "Admins can view all store products"
ON public.store_products FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert store products
CREATE POLICY "Admins can insert store products"
ON public.store_products FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update store products
CREATE POLICY "Admins can update store products"
ON public.store_products FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete store products
CREATE POLICY "Admins can delete store products"
ON public.store_products FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
