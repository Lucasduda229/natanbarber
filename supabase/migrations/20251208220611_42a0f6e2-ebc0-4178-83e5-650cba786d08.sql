-- Fix 1: Remove the overly permissive policy that exposes all customer PII
DROP POLICY IF EXISTS "Anyone can view profile names" ON public.profiles;

-- Fix 2: Add a DELETE policy for notifications so users can clean up their history
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);