-- Create tables that exist on the old Lovable Cloud project but were never
-- committed as migration files. They were created out-of-band (likely via
-- Lovable's dashboard SQL editor) and their schema was never captured in this
-- repo's migration history. Adding them here so:
--   1. The migration chain can complete cleanly on a fresh project.
--   2. Features depending on these tables work after cutover.
--
-- Shapes extracted 20 April 2026 directly from the live schema on Lovable Cloud.
-- No ALTER TABLE statements exist against these tables in later migrations, so
-- stubs use current live shape (no historical-shape juggling needed).

-- ============================================================================
-- handover_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.handover_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  voiceflow_user_id text NOT NULL,
  department_id uuid,
  original_department_id uuid,
  client_user_id uuid,
  takeover_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  timeout_duration integer,
  requested_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone,
  completed_at timestamp with time zone,
  completion_method text,
  transfer_note text,
  fallback_occurred boolean DEFAULT false,
  fallback_count integer DEFAULT 0,
  last_activity_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  agent_name text,
  transferred_from_agent_name text,
  transferred_from_department_name text,
  CONSTRAINT handover_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT handover_sessions_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'timeout'::text, 'transfer_timeout'::text, 'inactivity_timeout'::text])),
  CONSTRAINT handover_sessions_takeover_type_check
    CHECK (takeover_type = ANY (ARRAY['proactive'::text, 'requested'::text, 'transfer'::text])),
  CONSTRAINT handover_sessions_completion_method_check
    CHECK (completion_method = ANY (ARRAY['handback'::text, 'timeout'::text, 'transfer'::text, 'inactivity'::text])),
  CONSTRAINT handover_sessions_client_user_id_fkey
    FOREIGN KEY (client_user_id) REFERENCES public.client_users(id),
  CONSTRAINT handover_sessions_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id),
  CONSTRAINT handover_sessions_original_department_id_fkey
    FOREIGN KEY (original_department_id) REFERENCES public.departments(id),
  CONSTRAINT handover_sessions_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS handover_sessions_pending_timeout
  ON public.handover_sessions USING btree (requested_at)
  WHERE (status = 'pending'::text);
CREATE UNIQUE INDEX IF NOT EXISTS handover_sessions_active_unique
  ON public.handover_sessions USING btree (conversation_id)
  WHERE (status = ANY (ARRAY['pending'::text, 'active'::text]));
CREATE INDEX IF NOT EXISTS handover_sessions_active_inactivity
  ON public.handover_sessions USING btree (last_activity_at)
  WHERE (status = 'active'::text);

ALTER TABLE public.handover_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client users can update handover_sessions for their agents"
  ON public.handover_sessions FOR UPDATE
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    WHERE aa.client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can manage all handover_sessions"
  ON public.handover_sessions FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view handover_sessions for their agents"
  ON public.handover_sessions FOR SELECT
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    WHERE aa.client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))) OR is_super_admin(auth.uid())));

CREATE POLICY "Agency users can manage handover_sessions for their clients"
  ON public.handover_sessions FOR ALL
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    JOIN clients cl ON cl.id = aa.client_id
    JOIN agency_users au ON au.agency_id = cl.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

-- ============================================================================
-- audit_log
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid,
  agent_id uuid,
  actor_id uuid NOT NULL,
  actor_type text NOT NULL,
  action text NOT NULL,
  category text NOT NULL,
  target_type text,
  target_id uuid,
  actor_name text NOT NULL,
  actor_email text,
  target_name text,
  agent_name text,
  description text NOT NULL,
  changes jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL,
  CONSTRAINT audit_log_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_agent_id ON public.audit_log USING btree (agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_client_id ON public.audit_log USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id ON public.audit_log USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_category ON public.audit_log USING btree (category);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can view audit logs for their clients"
  ON public.audit_log FOR SELECT
  USING (((client_id IN (SELECT c.id FROM clients c
    JOIN agency_users au ON au.agency_id = c.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view their client audit logs"
  ON public.audit_log FOR SELECT
  USING (((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can view audit logs"
  ON public.audit_log FOR SELECT
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

-- This policy is DROPped by 20260329003945 then replaced with a stricter one.
-- Include it here so the DROP IF EXISTS is meaningful.
CREATE POLICY "System can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- canned_responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.canned_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid,
  user_id uuid,
  category text NOT NULL DEFAULT 'General'::text,
  title text NOT NULL,
  body text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_id uuid,
  CONSTRAINT canned_responses_pkey PRIMARY KEY (id),
  CONSTRAINT canned_responses_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE,
  CONSTRAINT canned_responses_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  CONSTRAINT canned_responses_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canned_responses_user
  ON public.canned_responses USING btree (user_id) WHERE (user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_canned_responses_agent
  ON public.canned_responses USING btree (agent_id) WHERE (agent_id IS NOT NULL);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read org canned responses"
  ON public.canned_responses FOR SELECT
  USING (((client_id IS NOT NULL) AND (client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))));

CREATE POLICY "Read own personal canned responses"
  ON public.canned_responses FOR SELECT
  USING ((user_id = auth.uid()));

CREATE POLICY "Manage own personal canned responses"
  ON public.canned_responses FOR ALL
  USING ((user_id = auth.uid()));

CREATE POLICY "Manage org canned responses"
  ON public.canned_responses FOR ALL
  USING (((client_id IS NOT NULL) AND (client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))));

-- ============================================================================
-- client_roles
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  is_admin_tier boolean DEFAULT false,
  is_system boolean DEFAULT false,
  is_default boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  client_permissions jsonb DEFAULT '{"audit_log": false, "settings_page": false}'::jsonb,
  CONSTRAINT client_roles_pkey PRIMARY KEY (id),
  CONSTRAINT client_roles_client_id_slug_key UNIQUE (client_id, slug),
  CONSTRAINT client_roles_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

ALTER TABLE public.client_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client users can manage their client_roles"
  ON public.client_roles FOR ALL
  USING ((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())));

CREATE POLICY "Client users can view own client roles"
  ON public.client_roles FOR SELECT
  USING ((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())));

CREATE POLICY "Client admins can manage own client roles"
  ON public.client_roles FOR ALL
  USING (has_settings_permission(auth.uid(), client_id));

CREATE POLICY "Agency users can manage their clients roles"
  ON public.client_roles FOR ALL
  USING ((client_id IN (SELECT id FROM clients
    WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))));

CREATE POLICY "Super admins can manage all client roles"
  ON public.client_roles FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage all client_roles"
  ON public.client_roles FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Agency users can manage client_roles for their clients"
  ON public.client_roles FOR ALL
  USING (((client_id IN (SELECT c.id FROM clients c
    JOIN agency_users au ON au.agency_id = c.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view their own client_roles"
  ON public.client_roles FOR SELECT
  USING (((client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))) OR is_super_admin(auth.uid())));

-- ============================================================================
-- client_user_departments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_user_departments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_user_id uuid NOT NULL,
  department_id uuid NOT NULL,
  notifications_enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_user_departments_pkey PRIMARY KEY (id),
  CONSTRAINT client_user_departments_client_user_id_department_id_key UNIQUE (client_user_id, department_id),
  CONSTRAINT client_user_departments_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE CASCADE,
  CONSTRAINT client_user_departments_client_user_id_fkey
    FOREIGN KEY (client_user_id) REFERENCES public.client_users(id) ON DELETE CASCADE
);

ALTER TABLE public.client_user_departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can manage client_user_departments"
  ON public.client_user_departments FOR ALL
  USING (((client_user_id IN (SELECT cu.id FROM client_users cu
    JOIN clients c ON c.id = cu.client_id
    JOIN agency_users au ON au.agency_id = c.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can manage all client_user_departments"
  ON public.client_user_departments FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view their own department assignments"
  ON public.client_user_departments FOR SELECT
  USING (((client_user_id IN (SELECT id FROM client_users WHERE user_id = auth.uid())) OR is_super_admin(auth.uid())));

-- ============================================================================
-- client_user_permissions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_user_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id uuid NOT NULL,
  role_id uuid,
  client_permissions jsonb DEFAULT '{}'::jsonb,
  has_overrides boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT client_user_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT client_user_permissions_user_id_client_id_key UNIQUE (user_id, client_id),
  CONSTRAINT client_user_permissions_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id),
  CONSTRAINT client_user_permissions_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES public.client_roles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_client_user_permissions_client ON public.client_user_permissions USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_client_user_permissions_user ON public.client_user_permissions USING btree (user_id);

ALTER TABLE public.client_user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client users can view their own client_user_permissions"
  ON public.client_user_permissions FOR SELECT
  USING (((user_id = auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can manage client_user_permissions"
  ON public.client_user_permissions FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Client admins can manage client_user_permissions"
  ON public.client_user_permissions FOR ALL
  USING (has_settings_permission(auth.uid(), client_id));

CREATE POLICY "Agency users can manage client_user_permissions"
  ON public.client_user_permissions FOR ALL
  USING ((client_id IN (SELECT id FROM clients
    WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))));

-- ============================================================================
-- conversation_read_status
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_read_status (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  is_read boolean DEFAULT false,
  last_read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_read_status_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_read_status_conversation_id_client_user_id_key
    UNIQUE (conversation_id, client_user_id),
  CONSTRAINT conversation_read_status_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE,
  CONSTRAINT conversation_read_status_client_user_id_fkey
    FOREIGN KEY (client_user_id) REFERENCES public.client_users(id) ON DELETE CASCADE
);

ALTER TABLE public.conversation_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all read status"
  ON public.conversation_read_status FOR SELECT
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can manage their own read status"
  ON public.conversation_read_status FOR ALL
  USING (((client_user_id IN (SELECT id FROM client_users WHERE user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Agency users can manage conversation_read_status"
  ON public.conversation_read_status FOR ALL
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    JOIN clients cl ON cl.id = aa.client_id
    JOIN agency_users au ON au.agency_id = cl.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

-- ============================================================================
-- conversation_status_history
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by_type text NOT NULL,
  changed_by_id uuid,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_status_history_changed_by_type_check
    CHECK (changed_by_type = ANY (ARRAY['system'::text, 'client_user'::text])),
  CONSTRAINT conversation_status_history_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conversation_status_history_conversation_id
  ON public.conversation_status_history USING btree (conversation_id);

ALTER TABLE public.conversation_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Client users can view status history for their agents"
  ON public.conversation_status_history FOR SELECT
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    WHERE aa.client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))) OR is_super_admin(auth.uid())));

CREATE POLICY "Admins can manage all status history"
  ON public.conversation_status_history FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

-- ============================================================================
-- conversation_tags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversation_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  tag_name text NOT NULL,
  is_system boolean DEFAULT false,
  applied_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT conversation_tags_pkey PRIMARY KEY (id),
  CONSTRAINT conversation_tags_conversation_id_tag_name_key UNIQUE (conversation_id, tag_name),
  CONSTRAINT conversation_tags_applied_by_fkey
    FOREIGN KEY (applied_by) REFERENCES public.client_users(id),
  CONSTRAINT conversation_tags_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS conversation_tags_tag_name ON public.conversation_tags USING btree (tag_name);
CREATE INDEX IF NOT EXISTS conversation_tags_conversation_id ON public.conversation_tags USING btree (conversation_id);

ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all conversation_tags"
  ON public.conversation_tags FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can manage conversation_tags for their agents"
  ON public.conversation_tags FOR ALL
  USING (((conversation_id IN (SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    WHERE aa.client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))) OR is_super_admin(auth.uid())));

-- ============================================================================
-- impersonation_sessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_type text NOT NULL,
  actor_name text NOT NULL,
  target_type text NOT NULL,
  target_user_id uuid,
  target_user_name text,
  agency_id uuid,
  client_id uuid,
  parent_session_id uuid,
  mode text NOT NULL DEFAULT 'full_access'::text,
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  ip_address text,
  CONSTRAINT impersonation_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT valid_session CHECK ((ended_at IS NULL) OR (ended_at > started_at)),
  CONSTRAINT impersonation_sessions_parent_session_id_fkey
    FOREIGN KEY (parent_session_id) REFERENCES public.impersonation_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_imp_sessions_actor ON public.impersonation_sessions USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_active ON public.impersonation_sessions USING btree (ended_at) WHERE (ended_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_imp_sessions_client ON public.impersonation_sessions USING btree (client_id);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can update their own impersonation sessions"
  ON public.impersonation_sessions FOR UPDATE
  USING ((actor_id = auth.uid()));

CREATE POLICY "Super admins can manage all impersonation sessions"
  ON public.impersonation_sessions FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage their impersonation sessions"
  ON public.impersonation_sessions FOR ALL
  USING (((actor_id = auth.uid()) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view sessions targeting their client"
  ON public.impersonation_sessions FOR SELECT
  USING ((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())));

CREATE POLICY "Users can read their own impersonation sessions"
  ON public.impersonation_sessions FOR SELECT
  USING ((actor_id = auth.uid()));

-- ============================================================================
-- role_permission_templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.role_permission_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  role_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{"specs": false, "analytics": false, "transcripts": false, "conversations": false, "agent_settings": false, "knowledge_base": false}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT role_permission_templates_pkey PRIMARY KEY (id),
  CONSTRAINT role_permission_templates_client_id_role_id_agent_id_key UNIQUE (client_id, role_id, agent_id),
  CONSTRAINT role_permission_templates_role_id_fkey
    FOREIGN KEY (role_id) REFERENCES public.client_roles(id) ON DELETE CASCADE,
  CONSTRAINT role_permission_templates_agent_id_fkey
    FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE,
  CONSTRAINT role_permission_templates_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE
);

ALTER TABLE public.role_permission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency users can manage role_permission_templates for their cli"
  ON public.role_permission_templates FOR ALL
  USING (((client_id IN (SELECT c.id FROM clients c
    JOIN agency_users au ON au.agency_id = c.agency_id
    WHERE au.user_id = auth.uid())) OR is_super_admin(auth.uid())));

CREATE POLICY "Client users can view their own role_permission_templates"
  ON public.role_permission_templates FOR SELECT
  USING (((client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))) OR is_super_admin(auth.uid())));

CREATE POLICY "Super admins can manage all role templates"
  ON public.role_permission_templates FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage their clients role templates"
  ON public.role_permission_templates FOR ALL
  USING ((client_id IN (SELECT id FROM clients
    WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))));

CREATE POLICY "Client admins can manage own role templates"
  ON public.role_permission_templates FOR ALL
  USING (has_settings_permission(auth.uid(), client_id));

CREATE POLICY "Client users can manage their role_permission_templates"
  ON public.role_permission_templates FOR ALL
  USING ((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())));

CREATE POLICY "Client users can view own role templates"
  ON public.role_permission_templates FOR SELECT
  USING ((client_id IN (SELECT client_id FROM client_users WHERE user_id = auth.uid())));

CREATE POLICY "Admins can manage all role_permission_templates"
  ON public.role_permission_templates FOR ALL
  USING ((is_admin(auth.uid()) OR is_super_admin(auth.uid())));
