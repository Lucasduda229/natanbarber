-- Remove the old constraint and add a new one that includes paid_card
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'paid_pix', 'paid_cash', 'paid_card', 'refunded'));