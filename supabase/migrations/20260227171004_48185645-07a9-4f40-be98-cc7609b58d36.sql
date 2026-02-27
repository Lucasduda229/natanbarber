
-- Add payment_status column to package_payments to track pending vs confirmed
ALTER TABLE public.package_payments ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

-- Update existing payments to 'confirmed' since they were already processed
UPDATE public.package_payments SET payment_status = 'confirmed' WHERE payment_status = 'pending';
