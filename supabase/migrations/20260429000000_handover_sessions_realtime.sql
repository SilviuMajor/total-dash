-- Add handover_sessions to supabase_realtime so the dashboard receives
-- INSERT/UPDATE/DELETE events. The table was working in production via
-- a manual dashboard add at some point, but never had a migration —
-- and got stripped, breaking the handover-request notification sound
-- (and silently degrading the pending-handover list to mount-only loads,
-- still appearing to work because conversations.status updates to
-- 'waiting' arrive on the conversations channel).
--
-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads carry the full old row
-- (e.g. for filtering on takeover_type or status); INSERTs don't need it.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'handover_sessions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.handover_sessions';
  END IF;
END $$;

ALTER TABLE public.handover_sessions REPLICA IDENTITY FULL;
