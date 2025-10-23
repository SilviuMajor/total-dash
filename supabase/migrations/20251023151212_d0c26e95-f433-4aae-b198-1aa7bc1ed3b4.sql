-- Add Stripe tracking columns to agency_subscriptions if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'agency_subscriptions' 
                 AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE public.agency_subscriptions 
    ADD COLUMN stripe_customer_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'agency_subscriptions' 
                 AND column_name = 'stripe_subscription_id') THEN
    ALTER TABLE public.agency_subscriptions 
    ADD COLUMN stripe_subscription_id TEXT;
  END IF;
END $$;