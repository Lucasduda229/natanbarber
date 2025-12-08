-- Criar o trigger para bloquear horários automaticamente quando um agendamento é confirmado
CREATE TRIGGER trigger_block_time_on_appointment_confirm
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.block_time_on_appointment_confirm();

-- Também vamos bloquear o agendamento existente que não foi bloqueado
INSERT INTO public.blocked_dates (blocked_date, blocked_time, reason)
SELECT appointment_date, appointment_time, 'Agendamento confirmado automaticamente'
FROM public.appointments 
WHERE status = 'confirmed'
AND NOT EXISTS (
  SELECT 1 FROM public.blocked_dates 
  WHERE blocked_date = appointments.appointment_date 
  AND blocked_time = appointments.appointment_time
)
ON CONFLICT DO NOTHING;