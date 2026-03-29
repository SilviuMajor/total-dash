
-- Fix 1: Replace overly permissive transcripts policy with scoped access
-- The widget needs to read transcripts for active handover sessions only
DROP POLICY IF EXISTS "Anon can read transcripts for handover" ON public.transcripts;

-- Create a function to check if a conversation has an active handover
CREATE OR REPLACE FUNCTION public.has_active_handover(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.handover_sessions
    WHERE conversation_id = _conversation_id
      AND status IN ('pending', 'active')
  )
$$;

-- Allow anon/authenticated to read transcripts only for conversations with active handovers
CREATE POLICY "Scoped transcript read for active handovers"
ON public.transcripts
FOR SELECT
USING (
  public.has_active_handover(conversation_id)
  OR is_super_admin(auth.uid())
);

-- Fix 2: Replace overly permissive audit_log INSERT policy
-- Audit logs should only be inserted by triggers (SECURITY DEFINER functions)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Create a SECURITY DEFINER function for audit log inserts
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  _client_id uuid,
  _actor_id uuid,
  _actor_type text,
  _action text,
  _category text,
  _description text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _target_name text DEFAULT NULL,
  _agent_id uuid DEFAULT NULL,
  _agent_name text DEFAULT NULL,
  _changes jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    client_id, actor_id, actor_type, action, category, description,
    target_type, target_id, target_name, agent_id, agent_name, changes,
    actor_name, actor_email
  ) VALUES (
    _client_id, _actor_id, _actor_type, _action, _category, _description,
    _target_type, _target_id, _target_name, _agent_id, _agent_name, _changes,
    get_actor_name(_actor_id), get_actor_email(_actor_id)
  );
END;
$$;

-- Fix 3: Create agents_safe view that hides API keys from client users
CREATE OR REPLACE VIEW public.agents_safe AS
SELECT
  id,
  name,
  provider,
  status,
  agency_id,
  data_region,
  created_at,
  updated_at,
  -- Strip sensitive keys from config
  (config - 'api_key' - 'voiceflow_api_key' - 'retell_api_key') AS config
FROM public.agents;

-- Grant access to the view
GRANT SELECT ON public.agents_safe TO anon, authenticated;
