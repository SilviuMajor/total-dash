-- search_conversations RPC: powers the upgraded CommandSearch dialog (client mode).
--
-- Searches a single agent's conversations across:
--   * caller_phone, user_name, user_email (structured fields)
--   * any tag in metadata.tags array
--   * metadata.note
--   * any custom-tracked Voiceflow variable in metadata.variables.*
--   * full transcript message text (excluding system rows + hidden button_click)
--
-- Plus filterable scoping:
--   * date range against last_activity_at
--   * status / department_id / tags (label match) / owner_id (mine-only)
--
-- Returns conversation rows + a "match attribution":
--   matched_field   one of 'name'|'email'|'phone'|'tag'|'note'|'variable'|'message'|'filter'
--   match_prefix / match_hit / match_suffix   structured strings around the matched substring,
--                  letting the React layer render `<mark>` without dangerouslySetInnerHTML.
--
-- Permission gate mirrored verbatim from update_agent_config
-- (20260426000000_codify_update_agent_config_rpc.sql + 20260426000030_…allow_client_users.sql):
-- super_admin OR agency_users for the agent's agency OR client_users assigned via agent_assignments.
-- SECURITY DEFINER required because cross-table reads (conversations + transcripts + agents +
-- agent_assignments + get_user_client_ids) would otherwise be blocked by per-table RLS even
-- when the explicit gate passes.

CREATE OR REPLACE FUNCTION public.search_conversations(
  p_agent_id        uuid,
  p_query           text,
  p_start_date      timestamptz,
  p_end_date        timestamptz,
  p_statuses        text[],
  p_department_ids  uuid[],
  p_tags            text[],
  p_owner_id        uuid,
  p_limit           int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  agent_id uuid,
  status text,
  caller_phone text,
  started_at timestamptz,
  last_activity_at timestamptz,
  metadata jsonb,
  matched_field text,
  match_prefix text,
  match_hit text,
  match_suffix text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_has_access boolean;
  v_q text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_agent_id IS NULL THEN
    RAISE EXCEPTION 'p_agent_id is required' USING ERRCODE = '22023';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.agents a
    WHERE a.id = p_agent_id
      AND (
        public.is_super_admin(v_uid)
        OR a.agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = v_uid)
        OR a.id IN (
          SELECT aa.agent_id
          FROM public.agent_assignments aa
          WHERE aa.client_id IN (SELECT client_id FROM public.get_user_client_ids(v_uid))
        )
      )
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'agent not found or access denied' USING ERRCODE = '42501';
  END IF;

  v_q := NULLIF(TRIM(COALESCE(p_query, '')), '');
  IF v_q IS NOT NULL AND length(v_q) < 3 THEN
    v_q := NULL;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT c.*
    FROM public.conversations c
    WHERE c.agent_id = p_agent_id
      AND c.is_archived = false
      AND (p_start_date IS NULL OR c.last_activity_at >= p_start_date)
      AND (p_end_date   IS NULL OR c.last_activity_at <= p_end_date)
      AND (p_statuses IS NULL OR cardinality(p_statuses) = 0 OR c.status = ANY(p_statuses))
      AND (p_department_ids IS NULL OR cardinality(p_department_ids) = 0 OR c.department_id = ANY(p_department_ids))
      AND (
        p_tags IS NULL OR cardinality(p_tags) = 0
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.metadata->'tags', '[]'::jsonb)) t
          WHERE t = ANY(p_tags)
        )
      )
      AND (p_owner_id IS NULL OR c.owner_id = p_owner_id)
      AND (
        v_q IS NULL
        OR c.caller_phone ILIKE '%' || v_q || '%'
        OR c.metadata::text ILIKE '%' || v_q || '%'
        OR EXISTS (
          SELECT 1 FROM public.transcripts t
          WHERE t.conversation_id = c.id
            AND t.speaker <> 'system'
            AND COALESCE((t.metadata->>'button_click')::boolean, false) = false
            AND t.text ILIKE '%' || v_q || '%'
        )
      )
  ),
  match_candidates AS (
    SELECT b.id AS conv_id, 'name'::text AS field, 1 AS priority,
           b.metadata->'variables'->>'user_name' AS source_text,
           NULL::timestamptz AS ts
      FROM base b
     WHERE v_q IS NOT NULL
       AND b.metadata->'variables'->>'user_name' ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'email', 2, b.metadata->'variables'->>'user_email', NULL
      FROM base b
     WHERE v_q IS NOT NULL
       AND b.metadata->'variables'->>'user_email' ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'phone', 3, b.caller_phone, NULL
      FROM base b
     WHERE v_q IS NOT NULL
       AND b.caller_phone ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'tag', 4, t.value, NULL
      FROM base b,
           jsonb_array_elements_text(COALESCE(b.metadata->'tags', '[]'::jsonb)) AS t(value)
     WHERE v_q IS NOT NULL
       AND t.value ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'note', 5, b.metadata->>'note', NULL
      FROM base b
     WHERE v_q IS NOT NULL
       AND b.metadata->>'note' ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'variable', 6, v.value, NULL
      FROM base b,
           jsonb_each_text(COALESCE(b.metadata->'variables', '{}'::jsonb)) AS v(key, value)
     WHERE v_q IS NOT NULL
       AND v.key NOT IN ('user_name', 'user_email')
       AND v.value ILIKE '%' || v_q || '%'
    UNION ALL
    SELECT b.id, 'message', 7, t.text, t.timestamp
      FROM base b
      JOIN public.transcripts t ON t.conversation_id = b.id
     WHERE v_q IS NOT NULL
       AND t.speaker <> 'system'
       AND COALESCE((t.metadata->>'button_click')::boolean, false) = false
       AND t.text ILIKE '%' || v_q || '%'
  ),
  top_match AS (
    SELECT DISTINCT ON (conv_id)
           conv_id, field, source_text
      FROM match_candidates
     ORDER BY conv_id, priority, ts ASC NULLS LAST
  ),
  enriched AS (
    SELECT
      b.id, b.agent_id, b.status, b.caller_phone, b.started_at, b.last_activity_at, b.metadata,
      tm.field, tm.source_text,
      CASE
        WHEN v_q IS NOT NULL AND tm.source_text IS NOT NULL
        THEN position(lower(v_q) in lower(tm.source_text))
        ELSE 0
      END AS pos
    FROM base b
    LEFT JOIN top_match tm ON tm.conv_id = b.id
  )
  SELECT
    e.id, e.agent_id, e.status, e.caller_phone, e.started_at, e.last_activity_at, e.metadata,
    CASE
      WHEN v_q IS NULL THEN 'filter'
      WHEN e.field IS NULL THEN 'filter'
      ELSE e.field
    END AS matched_field,
    CASE
      WHEN e.pos > 0 AND e.source_text IS NOT NULL
      THEN substring(e.source_text from greatest(1, e.pos - 30) for least(30, e.pos - 1))
      ELSE ''
    END AS match_prefix,
    CASE
      WHEN e.pos > 0 AND v_q IS NOT NULL AND e.source_text IS NOT NULL
      THEN substring(e.source_text from e.pos for length(v_q))
      ELSE ''
    END AS match_hit,
    CASE
      WHEN e.pos > 0 AND v_q IS NOT NULL AND e.source_text IS NOT NULL
      THEN substring(e.source_text from e.pos + length(v_q) for 30)
      ELSE ''
    END AS match_suffix
  FROM enriched e
  ORDER BY e.last_activity_at DESC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.search_conversations(uuid,text,timestamptz,timestamptz,text[],uuid[],text[],uuid,int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_conversations(uuid,text,timestamptz,timestamptz,text[],uuid[],text[],uuid,int) TO authenticated;
