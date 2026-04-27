-- N8: set_conversation_archived RPC.
-- Server-side gate for archiving / unarchiving a conversation. Mirrors the
-- update_agent_config pattern (super_admin OR agency_users OR client admin).
-- Archive forces an end: stamps ended_at + status = 'resolved' so the
-- conversation surfaces on the Transcripts page (which filters by
-- ended_at IS NOT NULL OR status = 'resolved'). Unarchive only clears the
-- visibility flag — leaves ended_at and status alone.
--
-- Errors:
--   42704 — conversation_not_found (existence check before permission check
--           so a malicious caller can't probe for IDs via error codes)
--   42501 — permission denied (caller is not super_admin / agency / client admin)

CREATE OR REPLACE FUNCTION public.set_conversation_archived(
  p_conversation_id uuid,
  p_archived boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agent_id uuid;
  v_agency_id uuid;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'p_conversation_id is required' USING ERRCODE = '22023';
  END IF;

  -- Existence check first. Resolve the conversation's agent → agency.
  SELECT c.agent_id, a.agency_id
    INTO v_agent_id, v_agency_id
    FROM public.conversations c
    JOIN public.agents a ON a.id = c.agent_id
   WHERE c.id = p_conversation_id;

  IF v_agent_id IS NULL THEN
    RAISE EXCEPTION 'conversation not found' USING ERRCODE = '42704';
  END IF;

  -- Permission check (any branch passes).
  IF public.is_super_admin(v_uid) THEN
    v_allowed := true;
  ELSIF v_agency_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.agency_users
     WHERE user_id = v_uid AND agency_id = v_agency_id
  ) THEN
    v_allowed := true;
  ELSIF EXISTS (
    SELECT 1
      FROM public.client_users cu
      JOIN public.client_roles cr ON cr.id = cu.role_id
      JOIN public.agent_assignments aa ON aa.client_id = cu.client_id
     WHERE cu.user_id = v_uid
       AND aa.agent_id = v_agent_id
       AND cr.is_admin_tier = true
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'permission denied: only admins can archive conversations'
      USING ERRCODE = '42501';
  END IF;

  IF p_archived THEN
    -- Archive forces an end: stamp ended_at if missing, ensure status = 'resolved'.
    UPDATE public.conversations
       SET is_archived = true,
           archived_at = now(),
           archived_by = v_uid,
           ended_at = COALESCE(ended_at, now()),
           status = CASE WHEN status = 'resolved' THEN status ELSE 'resolved' END
     WHERE id = p_conversation_id;
  ELSE
    -- Unarchive only clears visibility metadata. ended_at / status untouched.
    UPDATE public.conversations
       SET is_archived = false,
           archived_at = NULL,
           archived_by = NULL
     WHERE id = p_conversation_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_conversation_archived(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_conversation_archived(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.set_conversation_archived(uuid, boolean) IS
  'N8: admin-only archive toggle for conversations. Archive=true forces an end (ended_at + status=resolved). Unarchive=false leaves ended_at/status alone. SECURITY DEFINER; access scope = super_admin OR agency_users for agent.agency_id OR client_users with client_roles.is_admin_tier=true assigned to agent.';
