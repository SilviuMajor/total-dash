-- Add RLS policies for agency users to manage client data

-- 1. client_users - Agency users can manage users for their agency's clients
CREATE POLICY "Agency users can manage their clients' users"
ON public.client_users
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);

-- 2. user_roles - Agency users can manage roles for their agency's clients
CREATE POLICY "Agency users can manage roles for their clients"
ON public.user_roles
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);

-- 3. client_user_agent_permissions - Agency users can manage permissions
CREATE POLICY "Agency users can manage client user permissions"
ON public.client_user_agent_permissions
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);

-- 4. departments - Agency users can manage departments for their clients
CREATE POLICY "Agency users can manage departments"
ON public.departments
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);

-- 5. client_settings - Agency users can view and manage client settings
CREATE POLICY "Agency users can manage client settings"
ON public.client_settings
FOR ALL TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);

-- 6. agent_assignments - Agency users can view agent assignments for their clients
CREATE POLICY "Agency users can view client agent assignments"
ON public.agent_assignments
FOR SELECT TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients
    WHERE agency_id IN (
      SELECT agency_id FROM public.agency_users
      WHERE user_id = auth.uid()
    )
  )
);