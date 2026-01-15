-- Remove problematic policy that references auth.users and can cause "permission denied for table users"
DROP POLICY IF EXISTS "Allow insert for valid users" ON public.appointments;
