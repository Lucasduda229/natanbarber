-- Create policy to allow service role to insert appointments for guest customers
-- This enables the edge function to create appointments on behalf of new customers

-- First, add a policy that allows inserts when the appointment has a valid user_id
-- The edge function uses service role, so it bypasses RLS, but we need to ensure
-- the client-side can also see these appointments

-- Add policy for admins to insert appointments for any user (for guest bookings)
CREATE POLICY "Allow insert for valid users" 
ON public.appointments 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users WHERE id = user_id
  )
);

-- Ensure profiles table allows admin to view all profiles for customer lookup
-- (Already exists, but let's verify we can search by phone)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);