-- Codify update_agent_config RPC
--
-- This function is the canonical entry point for partial updates to agents.config
-- (a JSONB column). The frontend calls it from VoiceflowHandoverSettings,
-- VoiceflowConversationSettings, WidgetAppearanceSettings, WidgetFunctionsSettings,
-- and Conversations.tsx (tag editor). It performs a server-side JSONB merge so
-- callers never have to round-trip the full config — which prevents the
-- agents_safe-strips-api-keys footgun documented in CLAUDE.md rule #1.
--
-- This function previously existed in the live database but had no migration.
-- A project rebuild would have silently dropped it and broken every config save.
--
-- Scope: same as the agents UPDATE RLS policy (agency_users membership OR
-- super_admin). SECURITY DEFINER bypasses RLS so the function can read/write
-- the full agents row (including api_key); the WHERE clause re-implements the
-- access check.

CREATE OR REPLACE FUNCTION public.update_agent_config(
  p_agent_id uuid,
  p_config_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_agent_id IS NULL THEN
    RAISE EXCEPTION 'p_agent_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_config_updates IS NULL OR jsonb_typeof(p_config_updates) <> 'object' THEN
    RAISE EXCEPTION 'p_config_updates must be a JSON object' USING ERRCODE = '22023';
  END IF;

  UPDATE public.agents
     SET config     = COALESCE(config, '{}'::jsonb) || p_config_updates,
         updated_at = now()
   WHERE id = p_agent_id
     AND (
       public.is_super_admin(v_uid)
       OR agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = v_uid)
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'agent not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_agent_config(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_agent_config(uuid, jsonb) TO authenticated;
