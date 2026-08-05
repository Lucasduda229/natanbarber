CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $start
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone, referral_code)
  VALUES (
    new.id, 
    new.raw_user_meta_data ->> 'full_name', 
    new.raw_user_meta_data ->> 'phone',
    substr(new.id::text, 1, 8)
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN NEW;
END;
$start;

UPDATE public.profiles 
SET referral_code = substr(user_id::text, 1, 8) 
WHERE referral_code IS NULL;
