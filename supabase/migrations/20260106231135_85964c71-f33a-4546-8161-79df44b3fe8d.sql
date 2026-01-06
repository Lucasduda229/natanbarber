
-- Criar tabela de pacotes
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens do pacote
CREATE TABLE public.package_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_items ENABLE ROW LEVEL SECURITY;

-- Policies para packages
CREATE POLICY "Anyone can view active packages" 
ON public.packages FOR SELECT 
USING (active = true);

CREATE POLICY "Admins can manage packages" 
ON public.packages FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies para package_items
CREATE POLICY "Anyone can view package items" 
ON public.package_items FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage package items" 
ON public.package_items FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));
