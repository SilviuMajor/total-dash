-- Remove ElevenLabs API key column and add Resend API key column
ALTER TABLE public.agency_settings DROP COLUMN IF EXISTS elevenlabs_api_key;
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS resend_api_key TEXT;

-- Ensure support_email column exists
ALTER TABLE public.agency_settings ADD COLUMN IF NOT EXISTS support_email TEXT;