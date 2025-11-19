-- =============================================
-- SUPER ADMIN GOD MODE MIGRATION
-- Adds OR public.is_super_admin(auth.uid()) to all RLS policies
-- This allows super admins to bypass all RLS restrictions
-- =============================================

-- =============================================
-- SECTION 1: CORE IDENTITY TABLES
-- =============================================

-- profiles table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
-- This policy is now redundant, covered by the admin policy above

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE
USING (
  auth.uid() = id
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT
USING (
  auth.uid() = id
  OR public.is_super_admin(auth.uid())
);

-- super_admin_users table (already has super admin access, but make it explicit)
DROP POLICY IF EXISTS "Super admins can manage super admin users" ON public.super_admin_users;
CREATE POLICY "Super admins can manage super admin users" 
ON public.super_admin_users FOR ALL
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins can view all super admin users" ON public.super_admin_users;
CREATE POLICY "Super admins can view all super admin users" 
ON public.super_admin_users FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- =============================================
-- SECTION 2: AGENCY TABLES
-- =============================================

-- agencies table
DROP POLICY IF EXISTS "Agency owners can update their agency" ON public.agencies;
CREATE POLICY "Agency owners can update their agency" 
ON public.agencies FOR UPDATE
USING (
  (owner_id = auth.uid() OR is_agency_owner(auth.uid(), id))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can view their agency" ON public.agencies;
CREATE POLICY "Agency users can view their agency" 
ON public.agencies FOR SELECT
USING (
  id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all agencies" ON public.agencies;
CREATE POLICY "Super admins can manage all agencies" 
ON public.agencies FOR ALL
USING (public.is_super_admin(auth.uid()));

-- agency_users table
DROP POLICY IF EXISTS "Agency owners can manage team members" ON public.agency_users;
CREATE POLICY "Agency owners can manage team members" 
ON public.agency_users FOR ALL
USING (
  is_agency_owner(auth.uid(), agency_id)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all agency users" ON public.agency_users;
CREATE POLICY "Super admins can manage all agency users" 
ON public.agency_users FOR ALL
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own agency associations" ON public.agency_users;
CREATE POLICY "Users can view their own agency associations" 
ON public.agency_users FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- agency_settings table
DROP POLICY IF EXISTS "Agency users can manage their agency settings" ON public.agency_settings;
CREATE POLICY "Agency users can manage their agency settings" 
ON public.agency_settings FOR ALL
USING (
  agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all agency settings" ON public.agency_settings;
CREATE POLICY "Super admins can manage all agency settings" 
ON public.agency_settings FOR ALL
USING (public.is_super_admin(auth.uid()));

-- agency_subscriptions table
DROP POLICY IF EXISTS "Agency owners can update their subscription" ON public.agency_subscriptions;
CREATE POLICY "Agency owners can update their subscription" 
ON public.agency_subscriptions FOR UPDATE
USING (
  is_agency_owner(auth.uid(), agency_id)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can view their subscription" ON public.agency_subscriptions;
CREATE POLICY "Agency users can view their subscription" 
ON public.agency_subscriptions FOR SELECT
USING (
  agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all agency subscriptions" ON public.agency_subscriptions;
CREATE POLICY "Super admins can manage all agency subscriptions" 
ON public.agency_subscriptions FOR ALL
USING (public.is_super_admin(auth.uid()));

-- =============================================
-- SECTION 3: CLIENT TABLES
-- =============================================

-- clients table
DROP POLICY IF EXISTS "Agency users can manage their agency clients" ON public.clients;
CREATE POLICY "Agency users can manage their agency clients" 
ON public.clients FOR ALL
USING (
  agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all clients" ON public.clients;
CREATE POLICY "Super admins can manage all clients" 
ON public.clients FOR ALL
USING (public.is_super_admin(auth.uid()));

-- client_users table
DROP POLICY IF EXISTS "Admins can manage client users" ON public.client_users;
CREATE POLICY "Admins can manage client users" 
ON public.client_users FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can manage their clients' users" ON public.client_users;
CREATE POLICY "Agency users can manage their clients' users" 
ON public.client_users FOR ALL
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view their own client associations" ON public.client_users;
CREATE POLICY "Users can view their own client associations" 
ON public.client_users FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users with settings permission can manage client users" ON public.client_users;
CREATE POLICY "Users with settings permission can manage client users" 
ON public.client_users FOR ALL
USING (
  has_settings_permission(auth.uid(), client_id)
  OR public.is_super_admin(auth.uid())
);

-- client_settings table
DROP POLICY IF EXISTS "Admins can manage client settings" ON public.client_settings;
CREATE POLICY "Admins can manage client settings" 
ON public.client_settings FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can manage client settings" ON public.client_settings;
CREATE POLICY "Agency users can manage client settings" 
ON public.client_settings FOR ALL
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view their client settings" ON public.client_settings;
CREATE POLICY "Client users can view their client settings" 
ON public.client_settings FOR SELECT
USING (
  client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users with settings permission can update client settings" ON public.client_settings;
CREATE POLICY "Users with settings permission can update client settings" 
ON public.client_settings FOR UPDATE
USING (
  has_settings_permission(auth.uid(), client_id)
  OR public.is_super_admin(auth.uid())
);

-- client_subscriptions table
DROP POLICY IF EXISTS "Admins can manage client subscriptions" ON public.client_subscriptions;
CREATE POLICY "Admins can manage client subscriptions" 
ON public.client_subscriptions FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view their subscription" ON public.client_subscriptions;
CREATE POLICY "Client users can view their subscription" 
ON public.client_subscriptions FOR SELECT
USING (
  client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- departments table
DROP POLICY IF EXISTS "Admins can manage all departments" ON public.departments;
CREATE POLICY "Admins can manage all departments" 
ON public.departments FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can manage departments" ON public.departments;
CREATE POLICY "Agency users can manage departments" 
ON public.departments FOR ALL
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view their client's departments" ON public.departments;
CREATE POLICY "Client users can view their client's departments" 
ON public.departments FOR SELECT
USING (
  client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- SECTION 4: AGENT TABLES
-- =============================================

-- agents table
DROP POLICY IF EXISTS "Agency users can manage their agency agents" ON public.agents;
CREATE POLICY "Agency users can manage their agency agents" 
ON public.agents FOR ALL
USING (
  agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view assigned agents" ON public.agents;
CREATE POLICY "Client users can view assigned agents" 
ON public.agents FOR SELECT
USING (
  id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage all agents" ON public.agents;
CREATE POLICY "Super admins can manage all agents" 
ON public.agents FOR ALL
USING (public.is_super_admin(auth.uid()));

-- agent_assignments table
DROP POLICY IF EXISTS "Admins can manage agent assignments" ON public.agent_assignments;
CREATE POLICY "Admins can manage agent assignments" 
ON public.agent_assignments FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can view client agent assignments" ON public.agent_assignments;
CREATE POLICY "Agency users can view client agent assignments" 
ON public.agent_assignments FOR SELECT
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view their assignments" ON public.agent_assignments;
CREATE POLICY "Client users can view their assignments" 
ON public.agent_assignments FOR SELECT
USING (
  client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- agent_types table
DROP POLICY IF EXISTS "Admins can manage agent types" ON public.agent_types;
CREATE POLICY "Admins can manage agent types" 
ON public.agent_types FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view agent types" ON public.agent_types;
CREATE POLICY "Client users can view agent types" 
ON public.agent_types FOR SELECT
USING (
  true
  OR public.is_super_admin(auth.uid())
);

-- agent_workflows table
DROP POLICY IF EXISTS "Admins can manage agent workflows" ON public.agent_workflows;
CREATE POLICY "Admins can manage agent workflows" 
ON public.agent_workflows FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view workflows for their agents" ON public.agent_workflows;
CREATE POLICY "Client users can view workflows for their agents" 
ON public.agent_workflows FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- agent_workflow_categories table
DROP POLICY IF EXISTS "Admins can manage workflow categories" ON public.agent_workflow_categories;
CREATE POLICY "Admins can manage workflow categories" 
ON public.agent_workflow_categories FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view workflow categories for their agents" ON public.agent_workflow_categories;
CREATE POLICY "Client users can view workflow categories for their agents" 
ON public.agent_workflow_categories FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- agent_integrations table
DROP POLICY IF EXISTS "Admins can manage agent integrations" ON public.agent_integrations;
CREATE POLICY "Admins can manage agent integrations" 
ON public.agent_integrations FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view integrations for their agents" ON public.agent_integrations;
CREATE POLICY "Client users can view integrations for their agents" 
ON public.agent_integrations FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- agent_spec_sections table
DROP POLICY IF EXISTS "Admins can manage agent spec sections" ON public.agent_spec_sections;
CREATE POLICY "Admins can manage agent spec sections" 
ON public.agent_spec_sections FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view spec sections for their agents" ON public.agent_spec_sections;
CREATE POLICY "Client users can view spec sections for their agents" 
ON public.agent_spec_sections FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- agent_update_logs table
DROP POLICY IF EXISTS "Admins can manage update logs" ON public.agent_update_logs;
CREATE POLICY "Admins can manage update logs" 
ON public.agent_update_logs FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view update logs for their agents" ON public.agent_update_logs;
CREATE POLICY "Client users can view update logs for their agents" 
ON public.agent_update_logs FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- integration_options table
DROP POLICY IF EXISTS "Admins can manage integration options" ON public.integration_options;
CREATE POLICY "Admins can manage integration options" 
ON public.integration_options FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view integration options" ON public.integration_options;
CREATE POLICY "Client users can view integration options" 
ON public.integration_options FOR SELECT
USING (
  true
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- SECTION 5: PERMISSION TABLES
-- =============================================

-- user_roles table
DROP POLICY IF EXISTS "Admins can manage client roles" ON public.user_roles;
CREATE POLICY "Admins can manage client roles" 
ON public.user_roles FOR ALL
USING (
  has_role(auth.uid(), client_id, 'admin'::app_role)
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), client_id, 'admin'::app_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can view client roles" ON public.user_roles;
CREATE POLICY "Admins can view client roles" 
ON public.user_roles FOR SELECT
USING (
  has_role(auth.uid(), client_id, 'admin'::app_role)
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can manage roles for their clients" ON public.user_roles;
CREATE POLICY "Agency users can manage roles for their clients" 
ON public.user_roles FOR ALL
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" 
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- client_user_agent_permissions table
DROP POLICY IF EXISTS "Admins can manage all agent permissions" ON public.client_user_agent_permissions;
CREATE POLICY "Admins can manage all agent permissions" 
ON public.client_user_agent_permissions FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Agency users can manage client user permissions" ON public.client_user_agent_permissions;
CREATE POLICY "Agency users can manage client user permissions" 
ON public.client_user_agent_permissions FOR ALL
USING (
  client_id IN (SELECT id FROM clients WHERE agency_id IN (SELECT agency_id FROM agency_users WHERE user_id = auth.uid()))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users can view their own agent permissions" ON public.client_user_agent_permissions;
CREATE POLICY "Users can view their own agent permissions" 
ON public.client_user_agent_permissions FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Users with settings permission can manage agent permissions" ON public.client_user_agent_permissions;
CREATE POLICY "Users with settings permission can manage agent permissions" 
ON public.client_user_agent_permissions FOR ALL
USING (
  has_settings_permission(auth.uid(), client_id)
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- SECTION 6: ANALYTICS TABLES
-- =============================================

-- analytics_tabs table
DROP POLICY IF EXISTS "Admins can manage all analytics tabs" ON public.analytics_tabs;
CREATE POLICY "Admins can manage all analytics tabs" 
ON public.analytics_tabs FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can manage tabs for their assigned agents" ON public.analytics_tabs;
CREATE POLICY "Client users can manage tabs for their assigned agents" 
ON public.analytics_tabs FOR ALL
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view tabs for their assigned agents" ON public.analytics_tabs;
CREATE POLICY "Client users can view tabs for their assigned agents" 
ON public.analytics_tabs FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- analytics_cards table
DROP POLICY IF EXISTS "Admins can manage all analytics cards" ON public.analytics_cards;
CREATE POLICY "Admins can manage all analytics cards" 
ON public.analytics_cards FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can manage cards for their agent tabs" ON public.analytics_cards;
CREATE POLICY "Client users can manage cards for their agent tabs" 
ON public.analytics_cards FOR ALL
USING (
  tab_id IN (SELECT id FROM analytics_tabs WHERE agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view cards for their agent tabs" ON public.analytics_cards;
CREATE POLICY "Client users can view cards for their agent tabs" 
ON public.analytics_cards FOR SELECT
USING (
  tab_id IN (SELECT id FROM analytics_tabs WHERE agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))))
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- SECTION 7: COMMUNICATION TABLES
-- =============================================

-- conversations table
DROP POLICY IF EXISTS "Admins can update all conversations" ON public.conversations;
CREATE POLICY "Admins can update all conversations" 
ON public.conversations FOR UPDATE
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
CREATE POLICY "Admins can view all conversations" 
ON public.conversations FOR SELECT
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can update conversations for their agents" ON public.conversations;
CREATE POLICY "Client users can update conversations for their agents" 
ON public.conversations FOR UPDATE
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view conversations for their agents" ON public.conversations;
CREATE POLICY "Client users can view conversations for their agents" 
ON public.conversations FOR SELECT
USING (
  agent_id IN (SELECT agent_id FROM agent_assignments WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())))
  OR public.is_super_admin(auth.uid())
);

-- transcripts table
DROP POLICY IF EXISTS "Admins can view all transcripts" ON public.transcripts;
CREATE POLICY "Admins can view all transcripts" 
ON public.transcripts FOR SELECT
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Client users can view transcripts for their conversations" ON public.transcripts;
CREATE POLICY "Client users can view transcripts for their conversations" 
ON public.transcripts FOR SELECT
USING (
  conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN agent_assignments aa ON aa.agent_id = c.agent_id
    WHERE aa.client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
  )
  OR public.is_super_admin(auth.uid())
);

-- =============================================
-- SECTION 8: SYSTEM TABLES
-- =============================================

-- email_templates table
DROP POLICY IF EXISTS "Anyone authenticated can view email templates" ON public.email_templates;
CREATE POLICY "Anyone authenticated can view email templates" 
ON public.email_templates FOR SELECT
USING (
  true
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage email templates" ON public.email_templates;
CREATE POLICY "Super admins can manage email templates" 
ON public.email_templates FOR ALL
USING (public.is_super_admin(auth.uid()));

-- platform_branding table
DROP POLICY IF EXISTS "Anyone authenticated can view platform branding" ON public.platform_branding;
CREATE POLICY "Anyone authenticated can view platform branding" 
ON public.platform_branding FOR SELECT
USING (
  true
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage platform branding" ON public.platform_branding;
CREATE POLICY "Super admins can manage platform branding" 
ON public.platform_branding FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- subscription_plans table
DROP POLICY IF EXISTS "Anyone can view active subscription plans" ON public.subscription_plans;
CREATE POLICY "Anyone can view active subscription plans" 
ON public.subscription_plans FOR SELECT
USING (
  is_active = true
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "Super admins can manage subscription plans" ON public.subscription_plans;
CREATE POLICY "Super admins can manage subscription plans" 
ON public.subscription_plans FOR ALL
USING (public.is_super_admin(auth.uid()));

-- =============================================
-- SECTION 9: UTILITY TABLES
-- =============================================

-- auth_contexts table
DROP POLICY IF EXISTS "Super admins can manage all auth contexts" ON public.auth_contexts;
CREATE POLICY "Super admins can manage all auth contexts" 
ON public.auth_contexts FOR ALL
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own auth contexts" ON public.auth_contexts;
CREATE POLICY "Users can view their own auth contexts" 
ON public.auth_contexts FOR SELECT
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- user_passwords table
DROP POLICY IF EXISTS "Admins can manage user passwords" ON public.user_passwords;
CREATE POLICY "Admins can manage user passwords" 
ON public.user_passwords FOR ALL
USING (
  is_admin(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- email_send_log table
DROP POLICY IF EXISTS "Super admins can view all email logs" ON public.email_send_log;
CREATE POLICY "Super admins can view all email logs" 
ON public.email_send_log FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- =============================================
-- MIGRATION COMPLETE
-- Super admins now have God mode access to all tables
-- =============================================