-- Drop the trigger from the appointments table
DROP TRIGGER IF EXISTS on_payment_confirmed_add_subscription ON public.appointments;

-- Drop the function
DROP FUNCTION IF EXISTS public.auto_add_subscription_on_payment();
