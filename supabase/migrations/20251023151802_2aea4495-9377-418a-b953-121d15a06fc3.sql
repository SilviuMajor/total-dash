-- Add stripe_price_id column to subscription_plans if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'subscription_plans' 
                 AND column_name = 'stripe_price_id') THEN
    ALTER TABLE public.subscription_plans 
    ADD COLUMN stripe_price_id TEXT;
  END IF;
END $$;