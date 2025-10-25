-- Modify subscription_plans table
-- Add extras column for flexible custom features
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]'::jsonb;

-- Drop tier column (merge into name)
ALTER TABLE public.subscription_plans 
DROP COLUMN IF EXISTS tier;

-- Modify agency_subscriptions table
-- Add snapshot columns (locked at signup)
ALTER TABLE public.agency_subscriptions
ADD COLUMN IF NOT EXISTS snapshot_plan_name TEXT,
ADD COLUMN IF NOT EXISTS snapshot_price_monthly_cents INTEGER,
ADD COLUMN IF NOT EXISTS snapshot_max_clients INTEGER,
ADD COLUMN IF NOT EXISTS snapshot_max_agents INTEGER,
ADD COLUMN IF NOT EXISTS snapshot_max_team_members INTEGER,
ADD COLUMN IF NOT EXISTS snapshot_extras JSONB,
ADD COLUMN IF NOT EXISTS snapshot_created_at TIMESTAMPTZ;

-- Add custom override columns (set by superadmin)
ALTER TABLE public.agency_subscriptions
ADD COLUMN IF NOT EXISTS custom_price_monthly_cents INTEGER,
ADD COLUMN IF NOT EXISTS custom_max_clients INTEGER,
ADD COLUMN IF NOT EXISTS custom_max_agents INTEGER,
ADD COLUMN IF NOT EXISTS custom_max_team_members INTEGER,
ADD COLUMN IF NOT EXISTS custom_extras JSONB,
ADD COLUMN IF NOT EXISTS is_custom_pricing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_custom_limits BOOLEAN DEFAULT FALSE;

-- Add re-subscription tracking
ALTER TABLE public.agency_subscriptions
ADD COLUMN IF NOT EXISTS previous_subscription_id UUID REFERENCES public.agency_subscriptions(id),
ADD COLUMN IF NOT EXISTS resubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agency_subscriptions_stripe_subscription_id 
ON public.agency_subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_agency_subscriptions_stripe_customer_id 
ON public.agency_subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_agency_subscriptions_grace_period 
ON public.agency_subscriptions(grace_period_ends_at) 
WHERE grace_period_ends_at IS NOT NULL;

-- One-time migration: Create snapshots for existing subscriptions
-- Copy current plan values into snapshot fields for all existing subscriptions
UPDATE public.agency_subscriptions AS sub
SET 
  snapshot_plan_name = plan.name,
  snapshot_price_monthly_cents = plan.price_monthly_cents,
  snapshot_max_clients = plan.max_clients,
  snapshot_max_agents = plan.max_agents,
  snapshot_max_team_members = plan.max_team_members,
  snapshot_extras = COALESCE(plan.extras, '[]'::jsonb),
  snapshot_created_at = sub.created_at
FROM public.subscription_plans AS plan
WHERE sub.plan_id = plan.id
  AND sub.snapshot_plan_name IS NULL;