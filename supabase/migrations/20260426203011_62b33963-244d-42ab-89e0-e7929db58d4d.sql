
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_1h_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_lookup
ON public.appointments (appointment_date, appointment_time)
WHERE status NOT IN ('cancelled', 'no_show', 'completed');
