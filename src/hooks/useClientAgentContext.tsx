import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
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
  // API-key fields (api_key/voiceflow_api_key/retell_api_key) are stripped before this reaches consumers — see hook below.
  config?: Record<string, any>;
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
  // Raw client_settings.admin_capabilities flags. Use companySettingsPermissions
  // for role-gated checks; use this when you need the agency master switch alone
  // (e.g. hiding a feature in the chat input regardless of role permissions).
  companyCapabilities: Record<string, any>;
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
  companyCapabilities: {},
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

// ─── F15: Shared resolvers (single source of truth) ─────────────────────────
// The 4-layer permission stack — Agency ceiling → Client settings ceiling →
// Role template → User override — used to live in four near-duplicate copies
// inside this hook (preview, impersonation-as-user, real-user, and the
// per-agent useEffect). That drift is what produced F7. These helpers are the
// canonical resolvers; every call site now goes through them.

interface AgentScopedResolverInput {
  agentConfig: Record<string, any>;
  role: { is_admin_tier?: boolean } | null;
  template: Record<string, any>;
  hasOverrides: boolean;
  userOverrides: Record<string, any>;
}

function resolveAgentScopedKey(input: AgentScopedResolverInput, key: string): boolean {
  const { agentConfig, role, template, hasOverrides, userOverrides } = input;
  // Layer 1 — agency ceiling (per-agent config flag)
  const ceilingKey = 'client_' + key + '_enabled';
  if (agentConfig[ceilingKey] === false) return false;
  // Admin tier override (intentional — agency-set ceilings still apply above)
  if (role?.is_admin_tier) return true;
  // Layer 4 — user override (only honored when has_overrides flag is true)
  if (hasOverrides && userOverrides[key] !== undefined) return userOverrides[key];
  // Layer 3 — role template default
  return template[key] || false;
}

interface ClientScopedResolverInput {
  adminCaps: Record<string, any>;
  role: { is_admin_tier?: boolean; client_permissions?: Record<string, any> } | null;
  hasClientOverrides: boolean;
  userClientOverrides: Record<string, any>;
}

function resolveClientScopedKey(input: ClientScopedResolverInput, key: string, capKey: string): boolean {
  const { adminCaps, role, hasClientOverrides, userClientOverrides } = input;
  // Layer 2 — client_settings.admin_capabilities ceiling
  if (adminCaps[capKey] === false) return false;
  if (role?.is_admin_tier) return true;
  // Layer 4 — client-scoped override from client_user_permissions
  if (hasClientOverrides && userClientOverrides[key] !== undefined) return userClientOverrides[key];
  // Layer 3 — role.client_permissions default
  return role?.client_permissions?.[key] || false;
}

function buildAgentPermissions(
  agentInput: AgentScopedResolverInput,
  clientInput: ClientScopedResolverInput,
): AgentPermissions {
  return {
    conversations: resolveAgentScopedKey(agentInput, 'conversations'),
    transcripts: resolveAgentScopedKey(agentInput, 'transcripts'),
    analytics: resolveAgentScopedKey(agentInput, 'analytics'),
    specs: resolveAgentScopedKey(agentInput, 'specs'),
    knowledge_base: resolveAgentScopedKey(agentInput, 'knowledge_base'),
    guides: resolveAgentScopedKey(agentInput, 'guides'),
    agent_settings: resolveAgentScopedKey(agentInput, 'agent_settings'),
    settings_page: resolveClientScopedKey(clientInput, 'settings_page', 'settings_page_enabled'),
    audit_log: resolveClientScopedKey(clientInput, 'audit_log', 'client_audit_log_enabled'),
  };
}

function buildCompanySettingsPermissions(input: ClientScopedResolverInput): CompanySettingsPermissions {
  const r = (key: string, capKey: string) => resolveClientScopedKey(input, key, capKey);
  return {
    settings_page: r('settings_page', 'settings_page_enabled'),
    settings_departments_view: r('settings_departments_view', 'client_departments_enabled'),
    settings_departments_manage: r('settings_departments_manage', 'client_departments_enabled'),
    settings_team_view: r('settings_team_view', 'client_team_enabled'),
    settings_team_manage: r('settings_team_manage', 'client_team_enabled'),
    settings_canned_responses_view: r('settings_canned_responses_view', 'client_canned_responses_enabled'),
    settings_canned_responses_manage: r('settings_canned_responses_manage', 'client_canned_responses_enabled'),
    settings_general_view: r('settings_general_view', 'client_general_enabled'),
    settings_general_manage: r('settings_general_manage', 'client_general_enabled'),
    settings_audit_log_view: r('settings_audit_log_view', 'client_audit_log_enabled'),
  };
}

export function ClientAgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentPermissions, setSelectedAgentPermissions] = useState<AgentPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientId, setClientId] = useState<string | null>(null);
  const [userRoleSlug, setUserRoleSlug] = useState<string | null>(null);
  const [companySettingsPermissions, setCompanySettingsPermissions] = useState<CompanySettingsPermissions | null>(null);
  const [companyCapabilities, setCompanyCapabilities] = useState<Record<string, any>>({});
  const [isImpersonationReadOnly, setIsImpersonationReadOnly] = useState(false);
  const { user, profile } = useAuth();
  const { isClientPreviewMode, previewClient, previewDepth, userType } = useMultiTenantAuth();
  const { isImpersonating, activeSession, impersonationMode, targetUserId, targetClientId, loading: impersonationLoading } = useImpersonation();

  // F3/F9: refs used by the Realtime invalidation effects. Held in refs (not
  // closure) so the channel callbacks always read the latest selection and
  // refresh dispatcher without re-subscribing on every render.
  const selectedAgentIdRef = useRef<string | null>(null);
  const refreshFnRef = useRef<() => void>(() => {});
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { selectedAgentIdRef.current = selectedAgentId; }, [selectedAgentId]);

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

      // Load actual admin_capabilities so client-policy toggles
      // (e.g. canned_responses_personal_enabled) reflect the DB in preview.
      const { data: settings } = await supabase
        .from('client_settings')
        .select('admin_capabilities')
        .eq('client_id', previewClientId)
        .maybeSingle();
      setCompanyCapabilities((settings?.admin_capabilities || {}) as Record<string, any>);
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

      const clientScopedInput: ClientScopedResolverInput = {
        adminCaps, role, hasClientOverrides, userClientOverrides,
      };

      setCompanySettingsPermissions(buildCompanySettingsPermissions(clientScopedInput));
      setCompanyCapabilities(adminCaps);

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

          const agentScopedInput: AgentScopedResolverInput = {
            agentConfig, role, template, hasOverrides, userOverrides,
          };

          const { api_key: _ak1, voiceflow_api_key: _ak2, retell_api_key: _ak3, ...safeConfig } = agentConfig;

          return {
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            status: agent.status as Agent['status'],
            sort_order: a.sort_order ?? 0,
            config: safeConfig,
            effectivePermissions: buildAgentPermissions(agentScopedInput, clientScopedInput),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

      setAgents(agentsList.map(({ effectivePermissions, ...agent }: any) => agent));

      // F3/F9: preserve current selection across live invalidation reloads.
      const currentId = selectedAgentIdRef.current;
      const preserved = currentId ? agentsList.find((a: any) => a.id === currentId) : null;
      const chosen = preserved || agentsList[0];
      if (chosen) {
        if (!preserved) setSelectedAgentId(chosen.id);
        setSelectedAgentPermissions(chosen.effectivePermissions);
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

      const clientScopedInput: ClientScopedResolverInput = {
        adminCaps, role, hasClientOverrides, userClientOverrides,
      };

      setCompanySettingsPermissions(buildCompanySettingsPermissions(clientScopedInput));
      setCompanyCapabilities(adminCaps);

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

          const agentScopedInput: AgentScopedResolverInput = {
            agentConfig, role, template, hasOverrides, userOverrides,
          };

          const { api_key: _ak1, voiceflow_api_key: _ak2, retell_api_key: _ak3, ...safeConfig } = agentConfig;

          return {
            id: agent.id,
            name: agent.name,
            provider: agent.provider,
            status: agent.status as Agent['status'],
            sort_order: a.sort_order ?? 0,
            config: safeConfig,
            effectivePermissions: buildAgentPermissions(agentScopedInput, clientScopedInput),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order) || [];

      setAgents(agentsList.map(({ effectivePermissions, ...agent }: any) => agent));

      // F3/F9: preserve current selection across live invalidation reloads.
      const currentId = selectedAgentIdRef.current;
      const preserved = currentId ? agentsList.find((a: any) => a.id === currentId) : null;
      const chosen = preserved || agentsList[0];
      if (chosen) {
        if (!preserved) setSelectedAgentId(chosen.id);
        setSelectedAgentPermissions(chosen.effectivePermissions);
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
        try {
          // Get agent config (ceiling)
          const { data: agentData, error: agentErr } = await supabase
            .from('agents_safe' as any)
            .select('config')
            .eq('id', selectedAgentId)
            .single() as { data: { config: any } | null; error: any };
          if (agentErr) throw agentErr;
          const rawConfig = (agentData?.config || {}) as Record<string, any>;
          // Strip API keys from config for security
          const { api_key, voiceflow_api_key, retell_api_key, ...agentConfig } = rawConfig as any;

          // Get user's agent-scoped permission row
          const { data: userPerm, error: userPermErr } = await supabase
            .from('client_user_agent_permissions')
            .select('permissions, role_id, has_overrides')
            .eq('user_id', resolveUserId)
            .eq('agent_id', selectedAgentId)
            .eq('client_id', clientId)
            .single();
          if (userPermErr) throw userPermErr;

          const userOverrides = (userPerm?.permissions || {}) as Record<string, any>;
          const hasOverrides = userPerm?.has_overrides || false;
          const roleId = userPerm?.role_id;

          // Get role details
          let role: any = null;
          let template: Record<string, any> = {};
          if (roleId) {
            const { data: roleData, error: roleErr } = await supabase
              .from('client_roles')
              .select('*')
              .eq('id', roleId)
              .single();
            if (roleErr) throw roleErr;
            role = roleData;

            const { data: templateData } = await supabase
              .from('role_permission_templates')
              .select('permissions')
              .eq('role_id', roleId)
              .eq('agent_id', selectedAgentId)
              .eq('client_id', clientId)
              .maybeSingle();
            template = (templateData?.permissions || {}) as Record<string, any>;
          }

          // Client settings for client-scoped ceiling
          const { data: clientSettings } = await supabase
            .from('client_settings')
            .select('admin_capabilities')
            .eq('client_id', clientId)
            .maybeSingle();
          const adminCaps = (clientSettings?.admin_capabilities || {}) as Record<string, any>;

          // Client-scoped overrides come from client_user_permissions, NOT from
          // the agent-scoped permissions JSON (F7).
          const { data: userClientPerms } = await supabase
            .from('client_user_permissions')
            .select('client_permissions, has_overrides')
            .eq('user_id', resolveUserId)
            .eq('client_id', clientId)
            .maybeSingle();
          const userClientOverrides = (userClientPerms?.client_permissions || {}) as Record<string, any>;
          const hasClientOverrides = userClientPerms?.has_overrides || false;

          const agentScopedInput: AgentScopedResolverInput = {
            agentConfig, role, template, hasOverrides, userOverrides,
          };
          const clientScopedInput: ClientScopedResolverInput = {
            adminCaps, role, hasClientOverrides, userClientOverrides,
          };

          setSelectedAgentPermissions(buildAgentPermissions(agentScopedInput, clientScopedInput));
        } catch (err) {
          // F10: don't leave stale permissions from a previous agent on screen
          // if this resolve fails — fail closed (null clears all gated UI).
          console.error('[useClientAgentContext] loadAgentPermissions failed:', err);
          setSelectedAgentPermissions(null);
        }
      };
      loadAgentPermissions();
    }
  }, [selectedAgentId, user, clientId, profile, isImpersonating, impersonationMode, targetUserId]);

  // F3/F9: Realtime permission invalidation
  // ─────────────────────────────────────────
  // Without this, an admin changing role templates (F3) or Layer-2 ceilings
  // (F9) doesn't reach active client-user sessions until they hard-refresh.
  // We subscribe to the underlying tables and refetch on any change, debounced
  // so a "Apply to N users" burst coalesces into one refresh.

  // Keep the refresh dispatcher fresh so channel callbacks bound at subscribe
  // time always invoke the current loader closures.
  useEffect(() => {
    refreshFnRef.current = () => {
      if (isImpersonating && activeSession?.client_id && impersonationMode === 'view_as_user' && targetUserId) {
        loadClientAgentsAsUser(activeSession.client_id, targetUserId);
      } else if (profile?.role === 'client' && user) {
        loadClientAgents();
      }
      // Preview mode (loadClientAgentsForPreview) short-circuits to all-true,
      // so we intentionally don't re-run it on Realtime events.
    };
  });

  const triggerPermissionRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => refreshFnRef.current(), 250);
  };

  // Stable subs — re-bind only when the user/client identity changes.
  useEffect(() => {
    if (!user?.id || !clientId) return;
    if (isImpersonating && impersonationMode !== 'view_as_user') return; // skip preview mode
    if (!isImpersonating && profile?.role !== 'client') return;

    const resolveUserId = (isImpersonating && targetUserId) ? targetUserId : user.id;

    const channel = supabase
      .channel(`perm-invalidation-${clientId}-${resolveUserId}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'role_permission_templates', filter: `client_id=eq.${clientId}` }, triggerPermissionRefresh)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'client_roles', filter: `client_id=eq.${clientId}` }, triggerPermissionRefresh)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'client_settings', filter: `client_id=eq.${clientId}` }, triggerPermissionRefresh)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'client_user_permissions', filter: `user_id=eq.${resolveUserId}` }, triggerPermissionRefresh)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'client_user_agent_permissions', filter: `user_id=eq.${resolveUserId}` }, triggerPermissionRefresh)
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id, clientId, profile?.role, isImpersonating, impersonationMode, targetUserId]);

  // Per-agent ceiling sub — re-binds when the selected agent changes.
  useEffect(() => {
    if (!selectedAgentId || !clientId) return;
    if (isImpersonating && impersonationMode !== 'view_as_user') return;
    if (!isImpersonating && profile?.role !== 'client') return;

    const channel = supabase
      .channel(`perm-agent-${selectedAgentId}`)
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'agents', filter: `id=eq.${selectedAgentId}` }, triggerPermissionRefresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAgentId, clientId, profile?.role, isImpersonating, impersonationMode]);

  return (
    <ClientAgentContext.Provider
      value={{
        agents,
        selectedAgentId,
        setSelectedAgentId,
        selectedAgentPermissions,
        companySettingsPermissions,
        companyCapabilities,
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
