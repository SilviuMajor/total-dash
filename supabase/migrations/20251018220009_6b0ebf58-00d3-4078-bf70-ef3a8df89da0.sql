-- Add transcripts permission to client_settings default_user_permissions
UPDATE client_settings
SET default_user_permissions = jsonb_set(
  COALESCE(default_user_permissions, '{}'::jsonb),
  '{transcripts}',
  'true'::jsonb
)
WHERE NOT (default_user_permissions ? 'transcripts');

-- Add transcripts permission to existing client_user_agent_permissions
UPDATE client_user_agent_permissions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{transcripts}',
  'true'::jsonb
)
WHERE NOT (permissions ? 'transcripts');