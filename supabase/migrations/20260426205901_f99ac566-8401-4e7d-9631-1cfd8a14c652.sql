-- Tabela de configuração da conexão com o chatbot WhatsApp externo
CREATE TABLE public.whatsapp_bot_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bot_base_url TEXT,
  qrcode_endpoint TEXT,
  pairing_endpoint TEXT,
  status_endpoint TEXT,
  disconnect_endpoint TEXT,
  auth_header_name TEXT DEFAULT 'Authorization',
  auth_header_value TEXT,
  last_status TEXT DEFAULT 'disconnected',
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Apenas uma linha de configuração no sistema
CREATE UNIQUE INDEX whatsapp_bot_config_singleton ON public.whatsapp_bot_config ((true));

-- RLS: apenas administradores podem ler/escrever
ALTER TABLE public.whatsapp_bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view bot config"
ON public.whatsapp_bot_config
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert bot config"
ON public.whatsapp_bot_config
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bot config"
ON public.whatsapp_bot_config
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bot config"
ON public.whatsapp_bot_config
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger de updated_at
CREATE TRIGGER update_whatsapp_bot_config_updated_at
BEFORE UPDATE ON public.whatsapp_bot_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Linha inicial vazia
INSERT INTO public.whatsapp_bot_config (last_status) VALUES ('disconnected');