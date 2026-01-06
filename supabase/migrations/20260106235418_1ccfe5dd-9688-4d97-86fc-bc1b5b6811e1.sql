-- Remove a constraint antiga
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

-- Adiciona nova constraint com os valores atualizados
ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'paid_pix', 'paid_cash', 'refunded'));