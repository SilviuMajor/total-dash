-- Add columns to agency_settings for API keys
ALTER TABLE public.agency_settings
ADD COLUMN IF NOT EXISTS openai_api_key TEXT,
ADD COLUMN IF NOT EXISTS elevenlabs_api_key TEXT;