-- N8: Team-wide conversation archive flag.
-- /conversations always filters this out. Transcripts shows archived rows
-- behind an "Include archived" toggle. Set via set_conversation_archived RPC
-- (admin-only — super_admin OR agency_users OR client_users with
-- client_roles.is_admin_tier = true). Hard deletion is banned, so archive is
-- the only admin lever for hiding old conversations.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

COMMENT ON COLUMN public.conversations.is_archived IS
  'Admin-only visibility flag. /conversations always filters this out. Transcripts shows behind "Include archived" toggle. Set via set_conversation_archived RPC.';

COMMENT ON COLUMN public.conversations.archived_at IS
  'Timestamp when is_archived was last set to true. Cleared to NULL on unarchive.';

COMMENT ON COLUMN public.conversations.archived_by IS
  'auth.uid() of the admin who last archived. Cleared to NULL on unarchive.';
