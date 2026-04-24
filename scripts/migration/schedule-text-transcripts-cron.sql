-- Schedule hourly text-transcripts generation on the new project.
-- Uses pg_cron + pg_net to POST to the Edge Function with the project's anon key.

-- Unschedule any pre-existing job with the same name (idempotent re-run).
SELECT cron.unschedule('create-text-transcripts-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create-text-transcripts-hourly'
);

-- Schedule the job.
SELECT cron.schedule(
  'create-text-transcripts-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nznfznjlroycddegwvpt.supabase.co/functions/v1/create-text-transcripts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);
