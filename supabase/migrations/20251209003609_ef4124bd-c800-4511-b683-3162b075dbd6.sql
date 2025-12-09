-- Allow anyone to view profiles of users who have reviews (for public trust)
CREATE POLICY "Anyone can view profiles of reviewers"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reviews 
    WHERE reviews.user_id = profiles.user_id
  )
);