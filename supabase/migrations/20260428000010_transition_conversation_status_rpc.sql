-- I3 — atomic conversation status transition
--
-- Wraps the three writes that always travel together when a conversation
-- changes status (conversations row update + conversation_status_history
-- insert + system transcript insert) in a single Postgres function so they
-- commit as one transaction. Prevents the half-state where the status flip
-- lands but the system transcript / history row don't (or vice versa).
--
-- Callers: edge functions running as service_role
-- (handover-actions, handover-timer).

CREATE OR REPLACE FUNCTION public.transition_conversation_status(
  p_conversation_id uuid,
  p_to_status text,
  p_changed_by_type text,
  p_changed_by_id uuid DEFAULT NULL,
  p_history_metadata jsonb DEFAULT NULL,
  p_conversation_patch jsonb DEFAULT '{}'::jsonb,
  p_transcript_text text DEFAULT NULL,
  p_transcript_metadata jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_status text;
  v_transcript_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT status INTO v_from_status
    FROM conversations WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transition_conversation_status: conversation % not found', p_conversation_id;
  END IF;

  -- Whitelist of patchable conversation columns. Keys missing from the
  -- patch leave the column untouched; keys present (even with JSON null)
  -- overwrite. Anything outside this list is silently ignored.
  UPDATE conversations
  SET
    status = p_to_status,
    last_activity_at = v_now,
    owner_id = CASE WHEN p_conversation_patch ? 'owner_id'
                    THEN (p_conversation_patch->>'owner_id')::uuid
                    ELSE owner_id END,
    owner_name = CASE WHEN p_conversation_patch ? 'owner_name'
                      THEN p_conversation_patch->>'owner_name'
                      ELSE owner_name END,
    department_id = CASE WHEN p_conversation_patch ? 'department_id'
                         THEN (p_conversation_patch->>'department_id')::uuid
                         ELSE department_id END,
    ended_at = CASE WHEN p_conversation_patch ? 'ended_at'
                    THEN (p_conversation_patch->>'ended_at')::timestamptz
                    ELSE ended_at END,
    duration = CASE WHEN p_conversation_patch ? 'duration'
                    THEN (p_conversation_patch->>'duration')::int
                    ELSE duration END,
    resolution_reason = CASE WHEN p_conversation_patch ? 'resolution_reason'
                             THEN p_conversation_patch->>'resolution_reason'
                             ELSE resolution_reason END,
    resolution_note = CASE WHEN p_conversation_patch ? 'resolution_note'
                           THEN p_conversation_patch->>'resolution_note'
                           ELSE resolution_note END,
    needs_review_reason = CASE WHEN p_conversation_patch ? 'needs_review_reason'
                                THEN p_conversation_patch->>'needs_review_reason'
                                ELSE needs_review_reason END,
    first_unanswered_message_at = CASE WHEN p_conversation_patch ? 'first_unanswered_message_at'
                                        THEN (p_conversation_patch->>'first_unanswered_message_at')::timestamptz
                                        ELSE first_unanswered_message_at END
  WHERE id = p_conversation_id;

  INSERT INTO conversation_status_history
    (conversation_id, from_status, to_status, changed_by_type, changed_by_id, metadata)
  VALUES
    (p_conversation_id, v_from_status, p_to_status, p_changed_by_type, p_changed_by_id, p_history_metadata);

  IF p_transcript_text IS NOT NULL THEN
    INSERT INTO transcripts (conversation_id, speaker, text, metadata)
    VALUES (p_conversation_id, 'system', p_transcript_text, COALESCE(p_transcript_metadata, '{}'::jsonb))
    RETURNING id INTO v_transcript_id;
  END IF;

  RETURN jsonb_build_object(
    'from_status', v_from_status,
    'to_status', p_to_status,
    'transcript_id', v_transcript_id,
    'last_activity_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_conversation_status(uuid, text, text, uuid, jsonb, jsonb, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_conversation_status(uuid, text, text, uuid, jsonb, jsonb, text, jsonb) TO service_role;
