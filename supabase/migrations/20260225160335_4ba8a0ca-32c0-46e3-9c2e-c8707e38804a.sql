
-- Add requirement_type column to subscriber_rewards to support both months and visits
ALTER TABLE public.subscriber_rewards 
ADD COLUMN requirement_type TEXT NOT NULL DEFAULT 'months' CHECK (requirement_type IN ('months', 'visits'));

-- Add required_visits column for visit-based rewards
ALTER TABLE public.subscriber_rewards 
ADD COLUMN required_visits INTEGER DEFAULT NULL;

-- Remove the target_audience check constraint and update it to support both
ALTER TABLE public.subscriber_rewards DROP CONSTRAINT subscriber_rewards_target_audience_check;
ALTER TABLE public.subscriber_rewards ADD CONSTRAINT subscriber_rewards_target_audience_check 
CHECK (target_audience IN ('subscribers', 'all_clients'));

-- Create table to track delivered/claimed rewards
CREATE TABLE public.reward_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID REFERENCES public.subscriber_rewards(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  reward_name TEXT NOT NULL,
  reward_description TEXT NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
  admin_notes TEXT DEFAULT NULL
);

-- Enable RLS
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;

-- Admins can manage all claims
CREATE POLICY "Admins can manage reward claims"
ON public.reward_claims
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own claims
CREATE POLICY "Users can view their own reward claims"
ON public.reward_claims
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own claims
CREATE POLICY "Users can insert their own reward claims"
ON public.reward_claims
FOR INSERT
WITH CHECK (auth.uid() = user_id);
