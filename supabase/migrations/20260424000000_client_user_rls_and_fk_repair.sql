-- Repair: client users cannot read parent clients/agencies, and PostgREST cannot
-- join client_users -> client_user_agent_permissions because there is no declared FK.

-- 1. Helper function: resolve a user's client_id via client_users.
--    Mirrors the existing get_user_agency_id pattern.
CREATE OR REPLACE FUNCTION public.get_user_client_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_id
  FROM public.client_users
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- 2. SELECT policy on clients: client users can read their own client row.
DROP POLICY IF EXISTS "Client users can read their own client" ON public.clients;
CREATE POLICY "Client users can read their own client"
ON public.clients
FOR SELECT
TO authenticated
USING (id = public.get_user_client_id(auth.uid()));

-- 3. SELECT policy on agencies: client users can read the agency their client belongs to.
DROP POLICY IF EXISTS "Client users can read their agency" ON public.agencies;
CREATE POLICY "Client users can read their agency"
ON public.agencies
FOR SELECT
TO authenticated
USING (
  id = (
    SELECT agency_id
    FROM public.clients
    WHERE id = public.get_user_client_id(auth.uid())
  )
);

-- 4. Declare the missing FK so PostgREST can join client_users -> client_user_agent_permissions
--    via the shared user_id column (client_users.user_id is UNIQUE, verified prior to this migration).
--    Guarded in case the FK already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_user_agent_permissions_user_id_fkey'
      AND conrelid = 'public.client_user_agent_permissions'::regclass
  ) THEN
    ALTER TABLE public.client_user_agent_permissions
      ADD CONSTRAINT client_user_agent_permissions_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.client_users(user_id)
      ON DELETE CASCADE;
  END IF;
END$$;
