-- Migrate existing API keys into the config JSONB field
UPDATE agents 
SET config = CASE 
  WHEN provider = 'voiceflow' THEN 
    jsonb_build_object('voiceflow_api_key', api_key)
  WHEN provider = 'retell' THEN 
    jsonb_build_object('retell_api_key', api_key)
  ELSE config
END
WHERE api_key IS NOT NULL AND api_key != '' AND (config IS NULL OR config = '{}'::jsonb);

-- Add a comment to the api_key column indicating it's deprecated
COMMENT ON COLUMN agents.api_key IS 'Deprecated: Use config JSONB field for provider-specific settings';