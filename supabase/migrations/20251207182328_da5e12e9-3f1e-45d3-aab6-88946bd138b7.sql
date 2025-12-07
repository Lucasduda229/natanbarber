-- Create table for barbershop status
CREATE TABLE public.barbershop_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_open BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.barbershop_status ENABLE ROW LEVEL SECURITY;

-- Anyone can view the status
CREATE POLICY "Anyone can view barbershop status"
ON public.barbershop_status
FOR SELECT
USING (true);

-- Only admins can update the status
CREATE POLICY "Admins can update barbershop status"
ON public.barbershop_status
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default status (open)
INSERT INTO public.barbershop_status (is_open) VALUES (true);