-- Remove the policy that allows users to update their own loyalty progress
DROP POLICY IF EXISTS "Users can update their own loyalty progress" ON public.loyalty_progress;

-- Create a new policy that only allows admins to update loyalty progress
CREATE POLICY "Only admins can update loyalty progress" 
ON public.loyalty_progress 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));