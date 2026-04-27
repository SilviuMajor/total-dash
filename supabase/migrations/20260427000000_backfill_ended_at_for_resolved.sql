-- Backfill ended_at + duration for conversations that were resolved by staff
-- before handover-actions started stamping ended_at on the resolve transition.
--
-- Without this, the Transcripts page (which filters on ended_at IS NOT NULL)
-- silently excludes every staff-resolved conversation. After this runs and the
-- updated handover-actions Edge Function deploys, ended_at becomes the single
-- source of truth for "this conversation is in the archive".

UPDATE public.conversations
SET
  ended_at = COALESCE(last_activity_at, started_at),
  duration = CASE
    WHEN last_activity_at IS NOT NULL
      THEN GREATEST(
        0,
        EXTRACT(EPOCH FROM (last_activity_at - started_at))::int
      )
    ELSE duration
  END
WHERE status = 'resolved'
  AND ended_at IS NULL;
