import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMultiTenantAuth } from './useMultiTenantAuth';
import { useImpersonation } from './useImpersonation';

interface Agent {
  id: string;
  name: string;
  provider: string;
  sort_order: number;
  status?: 'active' | 'testing' | 'in_development';
}

interface AgentPermissions {
  conversations: boolean;
  transcripts: boolean;
  analytics: boolean;
  specs: boolean;
  knowledge_base: boolean;
  guides: boolean;
  agent_settings: boolean;
  settings_page: boolean;
  audit_log: boolean;
}

interface CompanySettingsPermissions {
  settings_page: boolean;
  settings_departments_view: boolean;
  settings_departments_manage: boolean;
  settings_team_view: boolean;
  settings_team_manage: boolean;
  settings_canned_responses_view: boolean;
  settings_canned_responses_manage: boolean;
  settings_general_view: boolean;
  settings_general_manage: boolean;
  settings_audit_log_view: boolean;
}

interface ClientAgentContextType {
  agents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string) => void;
  selectedAgentPermissions: AgentPermissions | null;
  companySettingsPermissions: CompanySettingsPermissions | null;
  loading: boolean;
  clientId: string | null;
  userRoleSlug: string | null;
  isImpersonationReadOnly: boolean;
}

const ClientAgentContext = createContext<ClientAgentContextType>({
  agents: [],
  selectedAgentId: null,
  setSelectedAgentId: () => {},
  selectedAgentPermissions: null,
  companySettingsPermissions: null,
  loading: true,
  clientId: null,
  userRoleSlug: null,
  isImpersonationReadOnly: false,
});

interface AgentAssignmentRow {
  agent_id: string;
  sort_order: number;
  agents: {
    id: string;
    name: string;
    provider: string;
    status: string;
  } | null;
}

export function ClientAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentPermissions, setSelectedAgentPermissions] = useState<AgentPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [userRoleSlug, setUserRoleSlug] = useState<string | null>(null);
  const [companySettingsPermissions, setCompanySettingsPermissions] = useState<CompanySettingsPermissions | null>(null);
  const [isImpersonationReadOnly, setIsImpersonationReadOnly] = useState(false);
  const { user, profile } = useAuth();
  const { isClientPreviewMode, previewClient, previewDepth, userType } = useMultiTenantAuth();
  const { isImpersonating, activeSession, impersonationMode, targetUserId, targetClientId, loading: impersonationLoading } = useImpersonation();

  useEffect(() => {
    const currentPath = window.location.pathname;

    // On admin routes, we never need client agent context
    if (currentPath.startsWith('/admin')) {
      setLoading(false);
      return;
    }

    // Wait for impersonation to finish loading before determining context
    if (impersonationLoading) return;

    // On agency routes WITHOUT client impersonation, we don't need client agent context
    if (currentPath.startsWith('/agency')) {
      const isClientImpersonation = isImpersonating && activeSession?.client_id;
      if (!isClientImpersonation) {
        setLoading(false);
        return;
      }
    }

    // Check for any form of client preview (admin or super_admin), with sessionStorage fallback
    const storedPreviewMode = sessionStorage.getItem('preview_mode');
    const storedPreviewClient = sessionStorage.getItem('preview_client');

    const isInClientPreview =
      isClientPreviewMode ||
      previewDepth === 'agency_to_client' ||
      previewDepth === 'client' ||
      (storedPreviewMode === 'client' && !!storedPreviewClient);

    if (user && profile) {
      // Impersonation takes priority over old preview mode
      if (isImpersonating && activeSession?.client_id) {
        if (impersonationMode === 'view_as_user' && targetUserId) {
          loadClientAgentsAsUser(activeSession.client_id, targetUserId);
        } else {
          loadClientAgentsForPreview(activeSession.client_id);
        }
        return;
      }

      if (isInClientPreview) {
        const effectiveClientId = previewClient?.id || storedPreviewClient;
        if (effectiveClientId) {
          loadClientAgentsForPreview(effectiveClientId);
        }
        return;
      } else if (profile.role === 'client') {
        loadClientAgents();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [user, profile, isClientPreviewMode, previewClient, previewDepth, isImpersonating, activeSession?.id, impersonationMode, targetUserId, impersonationLoading]);

  const loadClientAgentsForPreview = async (previewClientId: string) => {
    try {
      setClientId(previewClientId);
      setIsImpersonationReadOnly(false);

      // Get agents assigned to this client
      const { data: assignments, error: assignmentsError } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider,
            status
          )
        `)
        .eq('client_id', previewClientId)
        .order('sort_order', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      const agentsList = (assignments as AgentAssignmentRow[])
        ?.map(a => ({
          id: a.agents?.id ?? '',
          name: a.agents?.name ?? '',
          provider: a.agents?.provider ?? '',
          status: a.agents?.status as Agent['status'],
          sort_order: a.sort_order ?? 0
        }))
        .filter(a => a.id) || [];

      setAgents(agentsList);

      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
        
        // Admin preview mode: grant full permissions to all tabs
        setSelectedAgentPermissions({
          conversations: true,
          transcripts: true,
          analytics: true,
          specs: true,
          knowledge_base: true,
          guides: true,
          agent_settings: true,
          settings_page: true,
          audit_log: true,
        });
      }
      setUserRoleSlug('admin');
      setCompanySettingsPermissions({
        settings_page: true,
        settings_departments_view: true, settings_departments_manage: true,
        settings_team_view: true, settings_team_manage: true,
        settings_canned_responses_view: true, settings_canned_responses_manage: true,
        settings_general_view: true, settings_general_manage: true,
        settings_audit_log_view: true,
      });
    } catch (error) {
      console.error('Error loading client agents for preview:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientAgentsAsUser = async (targetClientIdParam: string, targetUserIdParam: string) => {
    try {
      setClientId(targetClientIdParam);
      setIsImpersonationReadOnly(true);

      // Get ALL agents assigned to this client
      const { data: assignments, error: assignmentsError } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider,
            status,
            config
          )
        `)
        .eq('client_id', targetClientIdParam)
        .order('sort_order', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      // Get TARGET user's permission rows
      const { data: userPerms } = await supabase
        .from('client_user_agent_permissions')
        .select('agent_id, permissions, role_id, has_overrides')
        .eq('user_id', targetUserIdParam)
        .eq('client_id', targetClientIdParam);

      // Get target user's role
      const userRoleId = userPerms?.find(p => p.role_id)?.role_id;

      let role: any = null;
      let roleTemplates: Record<string, any> = {};
      if (userRoleId) {
        const { data: roleData } = await supabase
          .from('client_roles')
          .select('*')
          .eq('id', userRoleId)
          .single();
        role = roleData;
        setUserRoleSlug(roleData?.slug || null);

        const { data: templates } = await supabase
          .from('role_permission_templates')
          .select('agent_id, permissions')
          .eq('role_id', userRoleId)
          .eq('client_id', targetClientIdParam);

        templates?.forEach(t => {
          roleTemplates[t.agent_id] = t.permissions;
        });
      }

      // Load client settings for ceilings
      const { data: clientSettings } = await supabase
        .from('client_settings')
        .select('admin_capabilities')
        .eq('client_id', targetClientIdParam)
        .single();
      const adminCaps = (clientSettings?.admin_capabilities || {}) as Record<string, any>;

      // Load target user's client-scoped overrides
      const { data: userClientPerms } = await supabase
        .from('client_user_permissions')
        .select('client_permissions, has_overrides')
        .eq('user_id', targetUserIdParam)
        .eq('client_id', targetClientIdParam)
        .maybeSingle();
      const userClientOverrides = (userClientPerms?.client_permissions || {}) as Record<string, any>;
      const hasClientOverrides = userClientPerms?.has_overrides || false;

      // Resolve company settings as target user
      const resolveCompanyPerm = (key: string, capKey: string): boolean => {
        if (adminCaps[capKey] === false) return false;
        if (role?.is_admin_tier) return true;
        if (hasClientOverrides && userClientOverrides[key] !== undefined) return userClientOverrides[key];
        return role?.client_permissions?.[key] || false;
      };

      setCompanySettingsPermissions({
        settings_page: resolveCompanyPerm('settings_page', 'settings_page_enabled'),
        settings_departments_view: resolveCompanyPerm('settings_departments_view', 'client_departments_enabled'),
        settings_departments_manage: resolveCompanyPerm('settings_departments_manage', 'client_departments_enabled'),
        settings_team_view: resolveCompanyPerm('settings_team_view', 'client_team_enabled'),
        settings_team_manage: resolveCompanyPerm('settings_team_manage', 'client_team_enabled'),
        settings_canned_responses_view: resolveCompanyPerm('settings_canned_responses_view', 'client_canned_responses_enabled'),
        settings_canned_responses_manage: resolveCompanyPerm('settings_canned_responses_manage', 'client_canned_responses_enabled'),
        settings_general_view: resolveCompanyPerm('settings_general_view', 'client_general_enabled'),
        settings_general_manage: resolveCompanyPerm('settings_general_manage', 'client_general_enabled'),
        settings_audit_log_view: resolveCompanyPerm('settings_audit_log_view', 'client_audit_log_enabled'),
      });

      // Build agent list — only agents the TARGET user has permission rows for
      const userPermMap = new Map(userPerms?.map(p => [p.agent_id, p]) || []);

      const agentsList = (assignments as any[])
        ?.map(a => {
          const agent = a.agents;
          if (!agent?.id) return null;
          const userPerm = userPermMap.get(agent.id);
          if (!userPerm) return null;

          const agentConfig = (agent.config || {}) as Record<string, any>;
          const template = roleTemplates[agent.id] || {};
          const userOverrides = (userPerm.permissions || {}) as Record<string, any>;
          const hasOverrides = userPerm.has_overrides;

          const resolvePermission = (key: string): boolean => {
            const ceilingKey = 'client_' + key + '_enabled';
            if (agentConfig[ceilingKey] === false) return false;
            if (role?.is_admin_tier) return true;
            if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
            return template[key] || false;
          };

          const resolveClientScoped = (key: string, capKey: string): boolean => {
            if (adminCaps[capKey] === false) return false;
            if (role?.is_admin_tier) return true;
            if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
            return role?.client_permissions?.[key] || false;
          };

          return {
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            status: agent.status as Agent['status'],
            sort_order: a.sort_order ?? 0,
            effectivePermissions: {
              conversations: resolvePermission('conversations'),
              transcripts: resolvePermission('transcripts'),
              analytics: resolvePermission('analytics'),
              specs: resolvePermission('specs'),
              knowledge_base: resolvePermission('knowledge_base'),
              guides: resolvePermission('guides'),
              agent_settings: resolvePermission('agent_settings'),
              settings_page: resolveClientScoped('settings_page', 'settings_page_enabled'),
              audit_log: resolveClientScoped('audit_log', 'client_audit_log_enabled'),
            } as AgentPermissions,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

      setAgents(agentsList.map(({ effectivePermissions, ...agent }: any) => agent));

      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
        setSelectedAgentPermissions(agentsList[0].effectivePermissions);
      } else {
        setSelectedAgentId(null);
        setSelectedAgentPermissions(null);
      }
    } catch (error) {
      console.error('Error loading client agents as user:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientAgents = async () => {
    try {
      // First, get the client_id for this user
      const { data: clientUserData, error: clientUserError } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (clientUserError) throw clientUserError;
      
      if (!clientUserData) {
        console.log('No client association found for user');
        setLoading(false);
        return;
      }

      setClientId(clientUserData.client_id);
      setIsImpersonationReadOnly(false);

      // Get ALL agents assigned to this client (not filtered by user permissions)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider,
            status,
            config
          )
        `)
        .eq('client_id', clientUserData.client_id)
        .order('sort_order', { ascending: true });

      if (assignmentsError) throw assignmentsError;

      // Get user's permission rows (includes role_id, permissions, has_overrides)
      const { data: userPerms } = await supabase
        .from('client_user_agent_permissions')
        .select('agent_id, permissions, role_id, has_overrides')
        .eq('user_id', user!.id)
        .eq('client_id', clientUserData.client_id);

      // Get the user's role (from first permission row that has a role_id)
      const userRoleId = userPerms?.find(p => p.role_id)?.role_id;

      // Load role details + role permission templates
      let role: any = null;
      let roleTemplates: Record<string, any> = {};
      if (userRoleId) {
        const { data: roleData } = await supabase
          .from('client_roles')
          .select('*')
          .eq('id', userRoleId)
          .single();
        role = roleData;
        setUserRoleSlug(roleData?.slug || null);

        const { data: templates } = await supabase
          .from('role_permission_templates')
          .select('agent_id, permissions')
          .eq('role_id', userRoleId)
          .eq('client_id', clientUserData.client_id);
        
        templates?.forEach(t => {
          roleTemplates[t.agent_id] = t.permissions;
        });
      }

      // Load client settings for client-scoped agency ceiling
      const { data: clientSettings } = await supabase
        .from('client_settings')
        .select('admin_capabilities')
        .eq('client_id', clientUserData.client_id)
        .single();
      const adminCaps = (clientSettings?.admin_capabilities || {}) as Record<string, any>;

      // Load user's client-scoped permission overrides
      const { data: userClientPerms } = await supabase
        .from('client_user_permissions')
        .select('client_permissions, has_overrides')
        .eq('user_id', user!.id)
        .eq('client_id', clientUserData.client_id)
        .maybeSingle();
      const userClientOverrides = (userClientPerms?.client_permissions || {}) as Record<string, any>;
      const hasClientOverrides = userClientPerms?.has_overrides || false;

      // Resolve company settings permissions
      const resolveCompanyPerm = (key: string, capKey: string): boolean => {
        if (adminCaps[capKey] === false) return false;
        if (role?.is_admin_tier) return true;
        if (hasClientOverrides && userClientOverrides[key] !== undefined) return userClientOverrides[key];
        return role?.client_permissions?.[key] || false;
      };

      setCompanySettingsPermissions({
        settings_page: resolveCompanyPerm('settings_page', 'settings_page_enabled'),
        settings_departments_view: resolveCompanyPerm('settings_departments_view', 'client_departments_enabled'),
        settings_departments_manage: resolveCompanyPerm('settings_departments_manage', 'client_departments_enabled'),
        settings_team_view: resolveCompanyPerm('settings_team_view', 'client_team_enabled'),
        settings_team_manage: resolveCompanyPerm('settings_team_manage', 'client_team_enabled'),
        settings_canned_responses_view: resolveCompanyPerm('settings_canned_responses_view', 'client_canned_responses_enabled'),
        settings_canned_responses_manage: resolveCompanyPerm('settings_canned_responses_manage', 'client_canned_responses_enabled'),
        settings_general_view: resolveCompanyPerm('settings_general_view', 'client_general_enabled'),
        settings_general_manage: resolveCompanyPerm('settings_general_manage', 'client_general_enabled'),
        settings_audit_log_view: resolveCompanyPerm('settings_audit_log_view', 'client_audit_log_enabled'),
      });

      // Build agent list — only include agents the user has permission rows for
      const userPermMap = new Map(userPerms?.map(p => [p.agent_id, p]) || []);

      const agentsList = (assignments as any[])
        ?.map(a => {
          const agent = a.agents;
          if (!agent?.id) return null;
          const userPerm = userPermMap.get(agent.id);
          if (!userPerm) return null; // User has no permission row for this agent

          const agentConfig = (agent.config || {}) as Record<string, any>;
          const template = roleTemplates[agent.id] || {};
          const userOverrides = (userPerm.permissions || {}) as Record<string, any>;
          const hasOverrides = userPerm.has_overrides;

          // Resolution: agency ceiling → override (if has_overrides) → role template
          const resolvePermission = (key: string): boolean => {
            // Agency ceiling check
            const ceilingKey = 'client_' + key + '_enabled';
            if (agentConfig[ceilingKey] === false) return false;
            // Admin role gets everything agency-enabled
            if (role?.is_admin_tier) return true;
            // User override
            if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
            // Role template
            return template[key] || false;
          };

          // Client-scoped permissions (not agent-dependent)
          const resolveClientScoped = (key: string, capKey: string): boolean => {
            if (adminCaps[capKey] === false) return false;
            if (role?.is_admin_tier) return true;
            if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
            return role?.client_permissions?.[key] || false;
          };

          return {
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            status: agent.status as Agent['status'],
            sort_order: a.sort_order ?? 0,
            effectivePermissions: {
              conversations: resolvePermission('conversations'),
              transcripts: resolvePermission('transcripts'),
              analytics: resolvePermission('analytics'),
              specs: resolvePermission('specs'),
              knowledge_base: resolvePermission('knowledge_base'),
              guides: resolvePermission('guides'),
              agent_settings: resolvePermission('agent_settings'),
              settings_page: resolveClientScoped('settings_page', 'settings_page_enabled'),
              audit_log: resolveClientScoped('audit_log', 'client_audit_log_enabled'),
            } as AgentPermissions,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

      setAgents(agentsList.map(({ effectivePermissions, ...agent }: any) => agent));

      if (agentsList.length > 0) {
        setSelectedAgentId(agentsList[0].id);
        setSelectedAgentPermissions(agentsList[0].effectivePermissions);
      }
    } catch (error) {
      console.error('Error loading client agents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update permissions when selected agent changes
  useEffect(() => {
    const shouldResolve = 
      (profile?.role === 'client') ||
      (isImpersonating && impersonationMode === 'view_as_user' && targetUserId);

    if (selectedAgentId && user && clientId && shouldResolve) {
      const resolveUserId = (isImpersonating && targetUserId) ? targetUserId : user.id;
      const loadAgentPermissions = async () => {
        // Get agent config (ceiling)
        const { data: agentData } = await supabase
          .from('agents_safe' as any)
          .select('config')
          .eq('id', selectedAgentId)
          .single();
        const rawConfig = (agentData?.config || {}) as Record<string, any>;
        // Strip API keys from config for security
        const { api_key, voiceflow_api_key, retell_api_key, ...agentConfig } = rawConfig as any;

        // Get user's permission row
        const { data: userPerm } = await supabase
          .from('client_user_agent_permissions')
          .select('permissions, role_id, has_overrides')
          .eq('user_id', resolveUserId)
          .eq('agent_id', selectedAgentId)
          .eq('client_id', clientId)
          .single();
        
        const userOverrides = (userPerm?.permissions || {}) as Record<string, any>;
        const hasOverrides = userPerm?.has_overrides || false;
        const roleId = userPerm?.role_id;

        // Get role details
        let role: any = null;
        let template: Record<string, any> = {};
        if (roleId) {
          const { data: roleData } = await supabase
            .from('client_roles')
            .select('*')
            .eq('id', roleId)
            .single();
          role = roleData;

          const { data: templateData } = await supabase
            .from('role_permission_templates')
            .select('permissions')
            .eq('role_id', roleId)
            .eq('agent_id', selectedAgentId)
            .eq('client_id', clientId)
            .single();
          template = (templateData?.permissions || {}) as Record<string, any>;
        }

        // Client settings for client-scoped ceiling
        const { data: clientSettings } = await supabase
          .from('client_settings')
          .select('admin_capabilities')
          .eq('client_id', clientId)
          .single();
        const adminCaps = (clientSettings?.admin_capabilities || {}) as Record<string, any>;

        const resolvePermission = (key: string): boolean => {
          const ceilingKey = 'client_' + key + '_enabled';
          if (agentConfig[ceilingKey] === false) return false;
          if (role?.is_admin_tier) return true;
          if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
          return template[key] || false;
        };

        const resolveClientScoped = (key: string, capKey: string): boolean => {
          if (adminCaps[capKey] === false) return false;
          if (role?.is_admin_tier) return true;
          if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
          return role?.client_permissions?.[key] || false;
        };

        setSelectedAgentPermissions({
          conversations: resolvePermission('conversations'),
          transcripts: resolvePermission('transcripts'),
          analytics: resolvePermission('analytics'),
          specs: resolvePermission('specs'),
          knowledge_base: resolvePermission('knowledge_base'),
          guides: resolvePermission('guides'),
          agent_settings: resolvePermission('agent_settings'),
          settings_page: resolveClientScoped('settings_page', 'settings_page_enabled'),
          audit_log: resolveClientScoped('audit_log', 'client_audit_log_enabled'),
        });
      };
      loadAgentPermissions();
    }
  }, [selectedAgentId, user, clientId, profile, isImpersonating, impersonationMode, targetUserId]);

  return (
    <ClientAgentContext.Provider
      value={{
        agents,
        selectedAgentId,
        setSelectedAgentId,
        selectedAgentPermissions,
        companySettingsPermissions,
        loading,
        clientId,
        userRoleSlug,
        isImpersonationReadOnly,
      }}
    >
      {children}
    </ClientAgentContext.Provider>
  );
}

export function useClientAgentContext() {
  return useContext(ClientAgentContext);
}
