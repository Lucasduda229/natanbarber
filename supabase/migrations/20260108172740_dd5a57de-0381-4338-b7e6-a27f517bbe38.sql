-- Fix appointments RLS: current policies are restrictive and end up AND-ing, blocking admins from viewing all appointments.
-- Replace with permissive policies.

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;

-- Admins: full access
CREATE POLICY "Admins can manage all appointments"
ON public.appointments
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users: own rows
CREATE POLICY "Users can view their own appointments"
ON public.appointments
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments"
ON public.appointments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
ON public.appointments
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);