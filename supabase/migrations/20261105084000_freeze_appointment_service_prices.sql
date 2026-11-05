-- Congela o preço dos serviços no momento do agendamento.
-- Assim, alterar o preço de um serviço em "services" NÃO altera
-- o financeiro de agendamentos já registrados (só afeta os futuros).

-- 1. Novas colunas
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
ALTER TABLE public.appointment_services ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);

-- 2. Backfill: registros existentes recebem o preço ATUAL do serviço
--    (rode esta migração ANTES de alterar qualquer preço)
UPDATE public.appointments a
SET price = COALESCE(s.price, 0)
FROM public.services s
WHERE a.service_id = s.id AND a.price IS NULL;

UPDATE public.appointment_services aps
SET price = COALESCE(s.price, 0)
FROM public.services s
WHERE aps.service_id = s.id AND aps.price IS NULL;

-- 3. Triggers: todo novo registro grava o preço vigente do serviço.
--    O valor é sempre definido pelo servidor (o cliente não consegue forçar outro preço).
CREATE OR REPLACE FUNCTION public.set_appointment_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT COALESCE(price, 0) INTO NEW.price
  FROM public.services
  WHERE id = NEW.service_id;
  NEW.price := COALESCE(NEW.price, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_appointment_price ON public.appointments;
CREATE TRIGGER trg_set_appointment_price
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.set_appointment_price();

-- Se o serviço principal do agendamento for trocado, atualiza o preço também
DROP TRIGGER IF EXISTS trg_update_appointment_price ON public.appointments;
CREATE TRIGGER trg_update_appointment_price
BEFORE UPDATE OF service_id ON public.appointments
FOR EACH ROW
WHEN (OLD.service_id IS DISTINCT FROM NEW.service_id)
EXECUTE FUNCTION public.set_appointment_price();

DROP TRIGGER IF EXISTS trg_set_appointment_service_price ON public.appointment_services;
CREATE TRIGGER trg_set_appointment_service_price
BEFORE INSERT ON public.appointment_services
FOR EACH ROW
EXECUTE FUNCTION public.set_appointment_price();
