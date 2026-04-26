-- Extend update_agent_config access scope to include client users assigned to
-- the agent. The codified RPC in 20260426000000 mirrored only the agents-table
-- UPDATE policy (super_admin OR agency_users), but in practice client users
-- need to save widget appearance / handover settings on agents they're assigned
-- to. The previous live (un-migrated) function permitted this; restoring it.

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
       OR id IN (
         SELECT aa.agent_id
         FROM public.agent_assignments aa
         WHERE aa.client_id IN (SELECT client_id FROM public.get_user_client_ids(v_uid))
       )
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'agent not found or access denied' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_agent_config(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_agent_config(uuid, jsonb) TO authenticated;
