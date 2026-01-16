-- Create table for admin settings including cash closing day
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Create policies - only admins can view and modify settings
CREATE POLICY "Admins can view settings" 
ON public.admin_settings 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" 
ON public.admin_settings 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings" 
ON public.admin_settings 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings" 
ON public.admin_settings 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default cash closing day (15th)
INSERT INTO public.admin_settings (setting_key, setting_value, description)
VALUES ('cash_closing_day', '15', 'Dia do mês para fechamento de caixa. Ex: 15 = período vai do dia 16 ao dia 15 do próximo mês.');