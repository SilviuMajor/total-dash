-- Add Stripe API key columns to agency_settings table
ALTER TABLE public.agency_settings
  ADD COLUMN IF NOT EXISTS stripe_secret_key text,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret text,
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text;