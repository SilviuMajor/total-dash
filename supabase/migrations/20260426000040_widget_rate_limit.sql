-- Per-IP rate limit for the public, anonymous voiceflow-interact endpoint.
--
-- The endpoint can't require a JWT (anonymous customers chatting via the
-- widget) so the only abuse-defense is request shape + a quota.
--
-- Storage: a small Postgres table keyed by an opaque string. The Edge
-- Function passes "<ip>:<agentId>" so a malicious actor can't burn through
-- multiple agents from the same IP, but a legitimate visitor on a shared
-- network (office NAT) chatting to one bot has its own bucket.
--
-- The check function is called via service-role from the Edge Function, so
-- RLS is not exposed — we simply REVOKE all from authenticated/anon to be safe.

CREATE TABLE IF NOT EXISTS public.widget_rate_limit (
  bucket_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

ALTER TABLE public.widget_rate_limit ENABLE ROW LEVEL SECURITY;
-- No policies — service role bypasses RLS, no other role should ever read this.

CREATE OR REPLACE FUNCTION public.widget_rate_limit_check(
  p_key text,
  p_max integer,
  p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_count integer;
  v_started timestamptz;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 THEN
    RAISE EXCEPTION 'p_key required' USING ERRCODE = '22023';
  END IF;
  IF p_max < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid limit args' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.widget_rate_limit (bucket_key, window_started_at, request_count)
  VALUES (p_key, v_now, 1)
  ON CONFLICT (bucket_key) DO UPDATE
    SET window_started_at = CASE
          WHEN public.widget_rate_limit.window_started_at < v_now - make_interval(secs => p_window_seconds)
          THEN v_now
          ELSE public.widget_rate_limit.window_started_at
        END,
        request_count = CASE
          WHEN public.widget_rate_limit.window_started_at < v_now - make_interval(secs => p_window_seconds)
          THEN 1
          ELSE public.widget_rate_limit.request_count + 1
        END
  RETURNING request_count, window_started_at INTO v_count, v_started;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.widget_rate_limit_check(text, integer, integer) FROM PUBLIC;
-- Edge Functions use service_role which bypasses GRANT checks; no GRANT needed.

-- Background cleanup: drop rows whose window expired more than an hour ago.
-- Called periodically by a cron or on-demand by the Edge Function (cheap).
CREATE OR REPLACE FUNCTION public.widget_rate_limit_gc() RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.widget_rate_limit
  WHERE window_started_at < now() - interval '1 hour';
$$;

REVOKE ALL ON FUNCTION public.widget_rate_limit_gc() FROM PUBLIC;
