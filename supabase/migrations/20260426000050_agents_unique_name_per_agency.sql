-- Prevent duplicate-agent races: two concurrent calls to the duplicate-agent
-- Edge Function would each find no existing "(Copy)" name, then both insert,
-- producing two agents with identical names. UNIQUE on (agency_id, name)
-- makes the second INSERT fail cleanly; the function's existing error path
-- surfaces it to the user.
--
-- A partial index (NULLS NOT DISTINCT not used — we want to allow legacy
-- agents with NULL agency_id to coexist if any exist).

CREATE UNIQUE INDEX IF NOT EXISTS agents_agency_id_name_key
  ON public.agents (agency_id, name)
  WHERE agency_id IS NOT NULL;
