-- Permite horário que vira a noite (fim <= início = continua até o dia seguinte)
ALTER TABLE public.special_hours DROP CONSTRAINT IF EXISTS special_hours_time_check;

