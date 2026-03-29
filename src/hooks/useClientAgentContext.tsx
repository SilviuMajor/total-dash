import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useMultiTenantAuth } from './useMultiTenantAuth';

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
}

const ClientAgentContext = createContext<ClientAgentContextType | undefined>(undefined);

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
  const { user, profile } = useAuth();
  const { isClientPreviewMode, previewClient, previewDepth, userType } = useMultiTenantAuth();

  useEffect(() => {
    // Check for any form of client preview (admin or super_admin), with sessionStorage fallback
    const storedPreviewMode = sessionStorage.getItem('preview_mode');
    const storedPreviewClient = sessionStorage.getItem('preview_client');

    const isInClientPreview =
      isClientPreviewMode ||
      previewDepth === 'agency_to_client' ||
      previewDepth === 'client' ||
      (storedPreviewMode === 'client' && !!storedPreviewClient);

    if (user && profile) {
      if (isInClientPreview) {
        // In preview mode, prefer previewClient from context but fall back to sessionStorage
        const effectiveClientId = previewClient?.id || storedPreviewClient;
        if (effectiveClientId) {
          loadClientAgentsForPreview(effectiveClientId);
        }
        // Don't set loading(false) yet - wait for preview data to load
        return;
      } else if (profile.role === 'client') {
        // Normal client mode: load from client_users
        loadClientAgents();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [user, profile, isClientPreviewMode, previewClient, previewDepth]);

  const loadClientAgentsForPreview = async (previewClientId: string) => {
    try {
      setClientId(previewClientId);

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
    if (selectedAgentId && user && clientId && profile?.role === 'client') {
      const loadAgentPermissions = async () => {
        // Get agent config (ceiling)
        const { data: agentData } = await supabase
          .from('agents')
          .select('config')
          .eq('id', selectedAgentId)
          .single();
        const agentConfig = (agentData?.config || {}) as Record<string, any>;

        // Get user's permission row
        const { data: userPerm } = await supabase
          .from('client_user_agent_permissions')
          .select('permissions, role_id, has_overrides')
          .eq('user_id', user.id)
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
  }, [selectedAgentId, user, clientId, profile]);

  return (
    <ClientAgentContext.Provider
      value={{
        agents,
        selectedAgentId,
        setSelectedAgentId,
        selectedAgentPermissions,
        loading,
        clientId,
        userRoleSlug,
      }}
    >
      {children}
    </ClientAgentContext.Provider>
  );
}

export function useClientAgentContext() {
  const context = useContext(ClientAgentContext);
  if (context === undefined) {
    throw new Error('useClientAgentContext must be used within a ClientAgentProvider');
  }
  return context;
}