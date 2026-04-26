-- N5: Add explicit inactivity baseline reset field on handover_sessions.
-- Set by handover-actions on take_over / accept_handover (and accept_transfer via delegation).
-- Read by handover-timer as part of Math.max(...) when computing the inactivity baseline.
-- Null is the default and falls through cleanly — only newly-touched sessions get a value.

ALTER TABLE handover_sessions
  ADD COLUMN IF NOT EXISTS inactivity_reset_at timestamptz NULL;

COMMENT ON COLUMN handover_sessions.inactivity_reset_at IS
  'Set when an agent action should reset the inactivity baseline (takeover/accept/transfer-accept). Read by handover-timer.';
