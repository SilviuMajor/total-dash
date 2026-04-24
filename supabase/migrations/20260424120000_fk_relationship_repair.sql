-- Repair: declare missing FKs so PostgREST can resolve frontend embedded joins.
-- Each FK is guarded so re-applying this migration is a no-op.
--
-- All three columns are nullable, so ON DELETE SET NULL is the conservative
-- choice — loss of the parent (role / department) nulls the reference but
-- preserves the child row (permission, user record, conversation history).

-- 1. client_user_agent_permissions.role_id -> client_roles.id
--    Used by permission-resolution queries that read the role alongside
--    per-agent overrides. role_id is already nullable (has_overrides pattern).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_user_agent_permissions_role_id_fkey'
      AND conrelid = 'public.client_user_agent_permissions'::regclass
  ) THEN
    ALTER TABLE public.client_user_agent_permissions
      ADD CONSTRAINT client_user_agent_permissions_role_id_fkey
      FOREIGN KEY (role_id)
      REFERENCES public.client_roles(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 2. client_users.role_id -> client_roles.id
--    Used by UserProfileCard and ClientUsersManagement which embed
--    `client_roles:client_roles(name)` alongside the user row.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_users_role_id_fkey'
      AND conrelid = 'public.client_users'::regclass
  ) THEN
    ALTER TABLE public.client_users
      ADD CONSTRAINT client_users_role_id_fkey
      FOREIGN KEY (role_id)
      REFERENCES public.client_roles(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 3. conversations.department_id -> departments.id
--    Conversations.tsx embeds `departments:department_id(name, code, color, ...)`.
--    handover_sessions.department_id already has an FK; conversations does not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_department_id_fkey'
      AND conrelid = 'public.conversations'::regclass
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES public.departments(id)
      ON DELETE SET NULL;
  END IF;
END$$;
