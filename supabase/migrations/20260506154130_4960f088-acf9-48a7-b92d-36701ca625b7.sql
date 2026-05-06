CREATE POLICY "Users can insert their own package payments"
ON public.package_payments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);