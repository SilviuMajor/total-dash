-- Schedule hourly text-transcripts generation on the new project.
-- Anon key is inlined by the runner at execution time.

SELECT cron.unschedule('create-text-transcripts-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'create-text-transcripts-hourly'
);

SELECT cron.schedule(
  'create-text-transcripts-hourly',
  '0 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://nznfznjlroycddegwvpt.supabase.co/functions/v1/create-text-transcripts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer :ANON_KEY'
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $job$
);
