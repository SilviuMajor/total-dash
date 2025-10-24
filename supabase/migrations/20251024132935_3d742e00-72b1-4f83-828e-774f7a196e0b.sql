-- Add manual override fields to agency_subscriptions
ALTER TABLE public.agency_subscriptions
ADD COLUMN IF NOT EXISTS manual_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS override_reason TEXT,
ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES auth.users(id);

-- Create function to auto-create trial subscription for new agencies
CREATE OR REPLACE FUNCTION public.auto_create_trial_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trial_plan_id UUID;
BEGIN
  -- Get the Free Trial plan ID
  SELECT id INTO trial_plan_id
  FROM public.subscription_plans
  WHERE tier = 'free_trial'
  LIMIT 1;

  -- If no trial plan exists, log and return
  IF trial_plan_id IS NULL THEN
    RAISE WARNING 'No trial plan found, skipping auto-subscription for agency %', NEW.id;
    RETURN NEW;
  END IF;

  -- Create trial subscription for new agency
  INSERT INTO public.agency_subscriptions (
    agency_id,
    plan_id,
    status,
    trial_ends_at,
    current_clients,
    current_agents,
    current_team_members,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    trial_plan_id,
    'trialing',
    NOW() + INTERVAL '7 days',
    0,
    0,
    1,
    NOW(),
    NOW() + INTERVAL '7 days'
  );

  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign trial on agency creation
DROP TRIGGER IF EXISTS trigger_auto_create_trial_subscription ON public.agencies;
CREATE TRIGGER trigger_auto_create_trial_subscription
AFTER INSERT ON public.agencies
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_trial_subscription();

-- Add comment for documentation
COMMENT ON FUNCTION public.auto_create_trial_subscription() IS 'Automatically creates a 7-day trial subscription when a new agency is created';