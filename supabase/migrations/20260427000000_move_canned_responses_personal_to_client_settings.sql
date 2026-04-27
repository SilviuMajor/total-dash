-- Move canned_responses_personal_enabled from agents.config to client_settings.admin_capabilities
--
-- Was per-agent; conceptually a client-wide policy. The canned_responses table
-- is keyed on (client_id, user_id) — there is no agent_id — so per-agent storage
-- gave the toggle no real scope, and broke on the agency-side settings view
-- where no agent is selected in context (loadClientAgentsForPreview short-circuits
-- on /agency routes, leaving selectedAgentId null).
--
-- Backfill: for each client, if any of its assigned agents had the flag set to
-- false, the client gets false. The read side defaults missing → true, matching
-- the previous per-agent default. Conflicting values across multiple agents
-- collapse to the more restrictive "false" — there is no UI today that exposes
-- per-agent divergence, so users could not have set it deliberately.

DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT aa.client_id
    FROM public.agent_assignments aa
    JOIN public.agents a ON a.id = aa.agent_id
    WHERE a.config ? 'canned_responses_personal_enabled'
      AND (a.config->>'canned_responses_personal_enabled')::boolean = false
  LOOP
    INSERT INTO public.client_settings (client_id, admin_capabilities)
    VALUES (rec.client_id, jsonb_build_object('canned_responses_personal_enabled', false))
    ON CONFLICT (client_id) DO UPDATE
    SET admin_capabilities = client_settings.admin_capabilities
        || jsonb_build_object('canned_responses_personal_enabled', false);
  END LOOP;
END $$;

-- Strip the old per-agent flag so we don't leave dual sources of truth.
UPDATE public.agents
SET config = config - 'canned_responses_personal_enabled'
WHERE config ? 'canned_responses_personal_enabled';
