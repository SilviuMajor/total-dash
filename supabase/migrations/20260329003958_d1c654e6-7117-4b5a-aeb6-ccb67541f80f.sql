
-- Fix the SECURITY DEFINER view issue - recreate as SECURITY INVOKER
DROP VIEW IF EXISTS public.agents_safe;

CREATE VIEW public.agents_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  name,
  provider,
  status,
  agency_id,
  data_region,
  created_at,
  updated_at,
  (config - 'api_key' - 'voiceflow_api_key' - 'retell_api_key') AS config
FROM public.agents;

GRANT SELECT ON public.agents_safe TO anon, authenticated;
