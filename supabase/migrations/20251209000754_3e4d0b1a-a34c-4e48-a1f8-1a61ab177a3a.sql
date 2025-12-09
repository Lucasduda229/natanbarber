-- Add admin notes field to profiles for personalized customer notes
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.admin_notes IS 'Notas do admin sobre preferências do cliente';