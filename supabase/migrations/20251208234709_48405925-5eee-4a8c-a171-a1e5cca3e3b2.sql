-- Criar tabela de junção para múltiplos serviços por agendamento
CREATE TABLE public.appointment_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appointment_id, service_id)
);

-- Enable RLS
ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their appointment services"
ON public.appointment_services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = appointment_services.appointment_id
    AND appointments.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create appointment services for their appointments"
ON public.appointment_services
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = appointment_services.appointment_id
    AND appointments.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all appointment services"
ON public.appointment_services
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Migrar dados existentes: copiar service_id de appointments para appointment_services
INSERT INTO public.appointment_services (appointment_id, service_id)
SELECT id, service_id FROM public.appointments WHERE service_id IS NOT NULL;

-- Comentário: manter service_id em appointments por compatibilidade temporária