-- Create a table to store revenue adjustments
CREATE TABLE public.revenue_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  original_value NUMERIC NOT NULL,
  adjusted_value NUMERIC NOT NULL,
  adjustment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

-- Enable Row Level Security
ALTER TABLE public.revenue_adjustments ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access only
CREATE POLICY "Admins can manage revenue adjustments" 
ON public.revenue_adjustments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_revenue_adjustments_updated_at
BEFORE UPDATE ON public.revenue_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();