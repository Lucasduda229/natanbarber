-- Horário de atendimento para dias específicos (substitui o horário semanal naquela data)
CREATE TABLE IF NOT EXISTS public.special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  special_date DATE NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT special_hours_time_check CHECK (end_time >= start_time)
);

ALTER TABLE public.special_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view special hours" ON public.special_hours;
CREATE POLICY "Anyone can view special hours"
ON public.special_hours FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admins can manage special hours" ON public.special_hours;
CREATE POLICY "Admins can manage special hours"
ON public.special_hours FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

