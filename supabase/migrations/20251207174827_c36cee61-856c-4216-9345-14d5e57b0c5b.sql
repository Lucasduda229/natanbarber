-- Update the handle_new_user function to automatically make the specific email an admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Check if the email is the admin email
  IF new.email = 'lucaspereirabn10@gmail.com' THEN
    user_role := 'admin';
  ELSE
    user_role := 'user';
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'phone');
  
  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, user_role);
  
  RETURN new;
END;
$$;

-- If the admin user already exists, update their role to admin
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Find the user with the admin email
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'lucaspereirabn10@gmail.com';
  
  IF admin_user_id IS NOT NULL THEN
    -- Delete existing role if any
    DELETE FROM public.user_roles WHERE user_id = admin_user_id;
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role) VALUES (admin_user_id, 'admin');
  END IF;
END $$;