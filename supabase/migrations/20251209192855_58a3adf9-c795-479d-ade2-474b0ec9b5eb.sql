-- Drop the overly permissive policy that exposes phone numbers and admin_notes
DROP POLICY IF EXISTS "Anyone can view profiles of reviewers" ON public.profiles;

-- Create a secure function to get only safe reviewer info (full_name and avatar_url only)
-- This prevents exposure of phone numbers and admin_notes
CREATE OR REPLACE FUNCTION public.get_reviewer_profiles(reviewer_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(reviewer_user_ids)
    AND EXISTS (SELECT 1 FROM reviews r WHERE r.user_id = p.user_id);
$$;