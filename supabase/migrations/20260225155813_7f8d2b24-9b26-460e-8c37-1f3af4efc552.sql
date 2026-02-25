
-- Table to store subscriber milestone rewards (based on consecutive months)
CREATE TABLE public.subscriber_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  required_months INTEGER NOT NULL,
  reward_description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  target_audience TEXT NOT NULL DEFAULT 'subscribers' CHECK (target_audience IN ('subscribers', 'all_clients')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriber_rewards ENABLE ROW LEVEL SECURITY;

-- Admins can manage
CREATE POLICY "Admins can manage subscriber rewards"
ON public.subscriber_rewards
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view active rewards
CREATE POLICY "Anyone can view active subscriber rewards"
ON public.subscriber_rewards
FOR SELECT
USING (is_active = true);

-- Seed the existing hardcoded rewards
INSERT INTO public.subscriber_rewards (name, required_months, reward_description, target_audience)
VALUES 
  ('Copo Stanley', 6, 'Copo Stanley exclusivo', 'subscribers'),
  ('Kit + 30% OFF', 12, 'Kit completo de barba + 30% de desconto', 'subscribers');
