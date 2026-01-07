-- Create subscription_progress table to track subscription duration
CREATE TABLE public.subscription_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consecutive_months INTEGER NOT NULL DEFAULT 0,
  last_payment_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  reward_6_months_claimed BOOLEAN NOT NULL DEFAULT false,
  reward_12_months_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.subscription_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress
CREATE POLICY "Users can view their own subscription progress"
ON public.subscription_progress
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert their own subscription progress"
ON public.subscription_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can manage all progress
CREATE POLICY "Admins can manage all subscription progress"
ON public.subscription_progress
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_subscription_progress_updated_at
BEFORE UPDATE ON public.subscription_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();