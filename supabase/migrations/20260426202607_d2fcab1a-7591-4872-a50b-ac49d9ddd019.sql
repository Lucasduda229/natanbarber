
-- Tabela de configuração de lembretes
CREATE TABLE IF NOT EXISTS public.reminder_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reminder_type text NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  message_template text NOT NULL,
  send_time time without time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reminder settings"
ON public.reminder_settings FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert reminder settings"
ON public.reminder_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reminder settings"
ON public.reminder_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reminder settings"
ON public.reminder_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reminder_settings_updated_at
BEFORE UPDATE ON public.reminder_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Dados padrão dos 3 lembretes
INSERT INTO public.reminder_settings (reminder_type, is_enabled, message_template, send_time)
VALUES
  (
    'appointment_confirmed',
    true,
    'Olá {nome}! ✅ Seu agendamento foi confirmado para {data} às {hora}. Serviço: {servico}. Te esperamos na Natan Barber!',
    NULL
  ),
  (
    'appointment_cancelled',
    true,
    'Olá {nome}, seu agendamento de {data} às {hora} ({servico}) foi cancelado. Para reagendar, acesse nosso app. Qualquer dúvida estamos à disposição!',
    NULL
  ),
  (
    'reminder_24h',
    true,
    'Oi {nome}! 👋 Lembrete: você tem um agendamento amanhã ({data}) às {hora} para {servico}. Confirma sua presença? Te aguardamos na Natan Barber!',
    '10:00:00'
  )
ON CONFLICT (reminder_type) DO NOTHING;
