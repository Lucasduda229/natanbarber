-- Create table for storing push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins can view all subscriptions (to send notifications)
CREATE POLICY "Admins can view all push subscriptions"
ON public.push_subscriptions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all subscriptions
CREATE POLICY "Admins can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert their own subscription
CREATE POLICY "Users can insert their own push subscription"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscription
CREATE POLICY "Users can delete their own push subscription"
ON public.push_subscriptions
FOR DELETE
USING (auth.uid() = user_id);

-- Users can view their own subscription
CREATE POLICY "Users can view their own push subscription"
ON public.push_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);