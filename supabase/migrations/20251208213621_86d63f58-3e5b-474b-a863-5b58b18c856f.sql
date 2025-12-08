-- Allow anyone to view profile names for reviews display
CREATE POLICY "Anyone can view profile names"
ON public.profiles
FOR SELECT
USING (true);