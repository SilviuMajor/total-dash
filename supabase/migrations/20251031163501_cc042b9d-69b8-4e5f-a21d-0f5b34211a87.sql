-- Schedule hourly cleanup of expired auth contexts
SELECT cron.schedule(
  'cleanup-expired-auth-contexts',
  '0 * * * *',
  $$
  DELETE FROM auth_contexts WHERE expires_at < now();
  $$
);