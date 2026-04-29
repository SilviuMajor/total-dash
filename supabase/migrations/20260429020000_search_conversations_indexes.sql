-- Trigram GIN indexes to back the search_conversations RPC.
--
-- pg_trgm makes ILIKE '%query%' fast at scale (without it, the RPC's transcript
-- ILIKE would seq-scan transcripts.text on every keystroke). The minimum query
-- length the RPC accepts is 3 chars, which is the trigram threshold.
--
-- Trade-off documented in the plan: indexing metadata::text means searching
-- the literal word "variables" or "user_name" matches every conversation,
-- because JSON keys are in the cast. Acceptable for breadth; switch to a
-- narrower expression index if it bites.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_transcripts_text_trgm
  ON public.transcripts USING gin (text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_conversations_metadata_text_trgm
  ON public.conversations USING gin ((metadata::text) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_conversations_caller_phone_trgm
  ON public.conversations USING gin (caller_phone gin_trgm_ops);
