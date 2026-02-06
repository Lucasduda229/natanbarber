-- Create table for package payments/renewals
CREATE TABLE public.package_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  package_id UUID REFERENCES public.packages(id),
  package_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'pix',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.package_payments ENABLE ROW LEVEL SECURITY;

-- Admins can manage all payments
CREATE POLICY "Admins can manage package payments" 
ON public.package_payments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own payments
CREATE POLICY "Users can view their own payments" 
ON public.package_payments 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add index for common queries
CREATE INDEX idx_package_payments_user_id ON public.package_payments(user_id);
CREATE INDEX idx_package_payments_payment_date ON public.package_payments(payment_date);