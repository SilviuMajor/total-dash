-- N6: Track session succession on handover_sessions.
-- Set by handover-actions on take_over when a prior session existed for the conversation
-- (e.g. timed-out, completed, inactivity_timeout). Lets the widget detect a refreshed
-- session via metadata, and gives us an audit trail when chasing takeover-after-timeout
-- bugs in production.

ALTER TABLE handover_sessions
  ADD COLUMN IF NOT EXISTS previous_session_id uuid NULL
    REFERENCES handover_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS handover_sessions_previous_session_id_idx
  ON handover_sessions (previous_session_id)
  WHERE previous_session_id IS NOT NULL;

COMMENT ON COLUMN handover_sessions.previous_session_id IS
  'Set by handover-actions take_over to the most recent prior handover_sessions row for this conversation, when one exists. NULL for first-time takeovers.';
