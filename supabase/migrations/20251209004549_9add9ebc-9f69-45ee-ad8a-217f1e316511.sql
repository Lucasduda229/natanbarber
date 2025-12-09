-- Tabela para programas de fidelidade criados pelo admin
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  required_visits INTEGER NOT NULL DEFAULT 10,
  reward_description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para progresso do cliente no programa
CREATE TABLE public.loyalty_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  current_visits INTEGER NOT NULL DEFAULT 0,
  rewards_claimed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, program_id)
);

-- Histórico de recompensas resgatadas
CREATE TABLE public.loyalty_rewards_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards_history ENABLE ROW LEVEL SECURITY;

-- Policies para loyalty_programs
CREATE POLICY "Admins can manage loyalty programs" ON public.loyalty_programs
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active loyalty programs" ON public.loyalty_programs
FOR SELECT USING (is_active = true);

-- Policies para loyalty_progress
CREATE POLICY "Admins can manage all loyalty progress" ON public.loyalty_progress
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own loyalty progress" ON public.loyalty_progress
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own loyalty progress" ON public.loyalty_progress
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own loyalty progress" ON public.loyalty_progress
FOR UPDATE USING (auth.uid() = user_id);

-- Policies para loyalty_rewards_history
CREATE POLICY "Admins can manage all rewards history" ON public.loyalty_rewards_history
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own rewards history" ON public.loyalty_rewards_history
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rewards" ON public.loyalty_rewards_history
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_loyalty_programs_updated_at
BEFORE UPDATE ON public.loyalty_programs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_progress_updated_at
BEFORE UPDATE ON public.loyalty_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();