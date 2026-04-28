import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useSuperAdminStatus } from "@/hooks/useSuperAdminStatus";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, AlertCircle, Loader2, ChevronDown, ChevronRight, Eye, Settings, Send, X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvatarUpload } from "@/components/AvatarUpload";


interface ClientUser {
  id: string;
  status: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  role_id: string | null;
  role_name: string | null;
  role_slug: string | null;
  is_admin_tier: boolean;
  has_overrides: boolean;
  profiles: {
    email: string;
    last_sign_in_at?: string | null;
  };
  departments?: {
    name: string;
    color?: string | null;
  };
  agent_permissions: Record<string, any>;
}

interface ClientRole {
  id: string;
  name: string;
  slug: string;
  is_admin_tier: boolean;
  is_system: boolean;
  is_default: boolean;
  client_permissions: Record<string, boolean>;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

interface Agent {
  id: string;
  name: string;
  provider: string;
  sort_order: number | null;
}

interface AgentPermission {
  agent_id: string;
  analytics: boolean;
  conversations: boolean;
  transcripts: boolean;
  knowledge_base: boolean;
  agent_settings: boolean;
  specs: boolean;
  guides: boolean;
}

const COMPANY_SETTINGS_TABS = [
  { key: "settings_departments", label: "Departments", capKey: "client_departments_enabled" },
  { key: "settings_team", label: "Team & permissions", capKey: "client_team_enabled" },
  { key: "settings_canned_responses", label: "Canned responses", capKey: "client_canned_responses_enabled" },
  { key: "settings_general", label: "General", capKey: "client_general_enabled" },
  { key: "settings_audit_log", label: "Audit log", capKey: "client_audit_log_enabled", viewOnly: true },
];

export function ClientUsersManagement({ clientId, readOnly }: { clientId: string; readOnly?: boolean }) {
  const { isPreviewMode, userType } = useMultiTenantAuth();
  const { isSuperAdmin, loading: isSuperAdminLoading } = useSuperAdminStatus();
  const { startImpersonation, isImpersonating } = useImpersonation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<ClientUser | null>(null);
  
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [overlayUser, setOverlayUser] = useState<ClientUser | null>(null);
  const [userDepts, setUserDepts] = useState<Record<string, any[]>>({});
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const toggleUserSelection = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const clearSelection = () => setSelectedUserIds(new Set());

  const bulkAssignDept = async (deptId: string) => {
    try {
      const inserts = Array.from(selectedUserIds).map(userId => ({
        client_user_id: userId,
        department_id: deptId,
      }));
      const { error } = await supabase.from('client_user_departments').upsert(inserts, { onConflict: 'client_user_id,department_id', ignoreDuplicates: true });
      if (error) throw error;
      toast({ title: "Done", description: `Department assigned to ${selectedUserIds.size} users` });
      clearSelection();
      loadUserDepts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const bulkChangeRole = async (roleId: string) => {
    try {
      for (const userId of selectedUserIds) {
        await supabase.from('client_user_agent_permissions').update({ role_id: roleId }).eq('client_id', clientId).eq('user_id', users.find(u => u.id === userId)?.user_id || '');
      }
      toast({ title: "Done", description: `Role changed for ${selectedUserIds.size} users` });
      clearSelection();
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const bulkSuspend = async () => {
    try {
      for (const userId of selectedUserIds) {
        const user = users.find(u => u.id === userId);
        if (user && user.status === 'active') {
          await supabase.from('client_users').update({ status: 'suspended' }).eq('id', userId);
        }
      }
      toast({ title: "Done", description: `${selectedUserIds.size} users suspended` });
      clearSelection();
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const [roleChangeModal, setRoleChangeModal] = useState<{ user: ClientUser; newRoleId: string } | null>(null);
  const [showRemovedUsers, setShowRemovedUsers] = useState(false);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, Record<string, any>>>({});
  const [agentCeilings, setAgentCeilings] = useState<Record<string, Record<string, any>>>({});
  const [clientCaps, setClientCaps] = useState<Record<string, any>>({});
  const [selectedUserClientPerms, setSelectedUserClientPerms] = useState<Record<string, boolean>>({});
  const [selectedUserAgentAccess, setSelectedUserAgentAccess] = useState<Record<string, boolean>>({});
  const [newUserAgentAccess, setNewUserAgentAccess] = useState<Record<string, boolean>>({});
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState<string>("none");
  const [newUserRoleId, setNewUserRoleId] = useState<string>("");
  const [newUserAvatar, setNewUserAvatar] = useState("");
  
  const [newUserAgentPermissions, setNewUserAgentPermissions] = useState<Record<string, AgentPermission>>({});
  const [selectedUserAgentPermissions, setSelectedUserAgentPermissions] = useState<Record<string, AgentPermission>>({});

  const { toast } = useToast();

  const getInitials = (name?: string | null, fallback?: string): string => {
    const src = name || fallback || "";
    if (!src.trim()) return "U";
    const parts = src.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatLastActive = (dateStr?: string | null) => {
    if (!dateStr) return 'Never logged in';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Active now';
    if (mins < 60) return `Active ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Active ${days}d ago`;
    return `Active ${Math.floor(days / 30)}mo ago`;
  };

  const openUserOverlay = async (user: ClientUser) => {
    setOverlayUser(user);
    setExpandedUserId(user.user_id);
    await loadUserAgentPermissions(user.user_id);
    await loadUserClientPermissions(user.user_id);
    if (user.role_id) {
      const templates = await loadRoleTemplates(user.role_id);
      setRoleTemplates(prev => ({ ...prev, [user.user_id]: templates }));
    }
  };

  const loadUserDepts = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('client_user_departments')
        .select('id, client_user_id, department_id, departments(name, color, sort_order)')
        .in('client_user_id', users.map(u => u.id));
      if (error) throw error;
      const grouped: Record<string, any[]> = {};
      (data || []).forEach((row: any) => {
        const cuId = row.client_user_id;
        if (!grouped[cuId]) grouped[cuId] = [];
        grouped[cuId].push({
          junction_id: row.id,
          department_id: row.department_id,
          name: row.departments?.name || 'Unknown',
          color: row.departments?.color || '#6B7280',
          sort_order: row.departments?.sort_order ?? 999,
        });
      });
      setUserDepts(grouped);
    } catch (error: any) {
      console.error('Error loading user departments:', error);
    }
  };

  useEffect(() => {
    if (users.length > 0) {
      loadUserDepts();
    }
  }, [users]);

  const addUserDept = async (userId: string, deptId: string) => {
    try {
      const { error } = await supabase.from('client_user_departments').insert({
        client_user_id: userId,
        department_id: deptId,
      });
      if (error) throw error;
      toast({ title: "Added", description: "Department assigned" });
      loadUserDepts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const removeUserDept = async (junctionId: string) => {
    try {
      const { error } = await supabase.from('client_user_departments').delete().eq('id', junctionId);
      if (error) throw error;
      toast({ title: "Removed", description: "Department removed" });
      loadUserDepts();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
    };
    checkAuth();
    if (isSuperAdminLoading) return;
    loadUsers();
    loadDepartments();
    loadAgents();
    loadRoles();
    loadAgentCeilings();
    loadClientCaps();
  }, [clientId, isSuperAdmin, isSuperAdminLoading, isPreviewMode]);

  useEffect(() => {
    if (newUserRoleId && agents.length > 0) {
      populatePermissionsFromRole(newUserRoleId);
    }
  }, [newUserRoleId, agents.length]);

  const loadRoles = async () => {
    const { data } = await supabase
      .from("client_roles")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order");
    const rolesList = (data || []) as ClientRole[];
    setRoles(rolesList);
    const defaultRole = rolesList.find(r => r.is_default) || rolesList.find(r => !r.is_admin_tier);
    if (defaultRole && !newUserRoleId) {
      setNewUserRoleId(defaultRole.id);
    }
  };

  const populatePermissionsFromRole = async (roleId: string) => {
    const templates = await loadRoleTemplates(roleId);
    const perms: Record<string, AgentPermission> = {};
    agents.forEach(agent => {
      const template = templates[agent.id] || {};
      perms[agent.id] = {
        agent_id: agent.id,
        conversations: template.conversations || false,
        transcripts: template.transcripts || false,
        analytics: template.analytics || false,
        specs: template.specs || false,
        knowledge_base: template.knowledge_base || false,
        guides: template.guides || false,
        agent_settings: template.agent_settings || false,
      };
    });
    setNewUserAgentPermissions(perms);

    const access: Record<string, boolean> = {};
    agents.forEach(a => { access[a.id] = true; });
    setNewUserAgentAccess(access);
  };

  const loadAgentCeilings = async () => {
    const { data: assignments } = await supabase
      .from("agent_assignments")
      .select("agent_id, agents(id, name, config)")
      .eq("client_id", clientId);
    const ceilings: Record<string, Record<string, any>> = {};
    (assignments || []).forEach((a: any) => {
      if (a.agents) ceilings[a.agents.id] = a.agents.config || {};
    });
    setAgentCeilings(ceilings);
  };

  const loadClientCaps = async () => {
    const { data } = await supabase
      .from("client_settings")
      .select("admin_capabilities")
      .eq("client_id", clientId)
      .single();
    setClientCaps((data?.admin_capabilities || {}) as Record<string, any>);
  };

  const loadRoleTemplates = async (roleId: string) => {
    const { data } = await supabase
      .from("role_permission_templates")
      .select("agent_id, permissions")
      .eq("role_id", roleId)
      .eq("client_id", clientId);
    const map: Record<string, any> = {};
    (data || []).forEach((t: any) => { map[t.agent_id] = t.permissions || {}; });
    return map;
  };

  const loadUsers = async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);

    try {
      const isSuperAdminPreview = isPreviewMode && isSuperAdmin === true;

      if (isSuperAdminPreview) {
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'get-client-users',
          { body: { clientId } }
        );

        if (functionError) {
          console.error('[ClientUsersManagement] get-client-users error:', functionError);
          setError('Failed to load users in preview mode');
          setUsers([]);
          setLoading(false);
          return;
        }

        // For preview, fetch role info from client_user_agent_permissions
        const previewUsers = functionData?.users || [];
        const userIds = previewUsers.map((u: any) => u.user_id);
        const rolesByUser: Record<string, { role_id: string | null; has_overrides: boolean }> = {};
        const allPermsByUser: Record<string, Record<string, any>> = {};

        if (userIds.length > 0) {
          const { data: permRows } = await supabase
            .from('client_user_agent_permissions')
            .select('user_id, role_id, has_overrides, permissions, agent_id')
            .eq('client_id', clientId)
            .in('user_id', userIds);

          const seenUsers = new Set<string>();
          (permRows || []).forEach((r: any) => {
            if (!seenUsers.has(r.user_id)) {
              seenUsers.add(r.user_id);
              rolesByUser[r.user_id] = { role_id: r.role_id, has_overrides: r.has_overrides || false };
            }
            if (!allPermsByUser[r.user_id]) allPermsByUser[r.user_id] = {};
            allPermsByUser[r.user_id][r.agent_id] = r.permissions || {};
          });
        }

        const roleIds = [...new Set(Object.values(rolesByUser).map(r => r.role_id).filter(Boolean))] as string[];
        const roleMap: Record<string, ClientRole> = {};
        if (roleIds.length > 0) {
          const { data: rolesData } = await supabase.from('client_roles').select('*').in('id', roleIds);
          (rolesData || []).forEach((r: any) => { roleMap[r.id] = r; });
        }

        const usersWithRoles = previewUsers.map((u: any) => {
          const roleInfo = rolesByUser[u.user_id] || { role_id: null, has_overrides: false };
          const role = roleInfo.role_id ? roleMap[roleInfo.role_id] : null;
          return {
            id: u.id,
            status: u.status || 'active',
            user_id: u.user_id,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            department_id: u.department_id,
            profiles: u.profiles || { email: '' },
            departments: u.departments || undefined,
            role_id: roleInfo.role_id || null,
            role_name: role?.name || null,
            role_slug: role?.slug || null,
            is_admin_tier: role?.is_admin_tier || false,
            has_overrides: roleInfo.has_overrides || false,
            agent_permissions: allPermsByUser[u.user_id] || {},
          };
        });

        setUsers(usersWithRoles);
        setLoading(false);
        return;
      }

      // Normal path
      const { data: clientUsers, error } = await supabase
        .from('client_users')
        .select(`
          id,
          user_id,
          full_name,
          avatar_url,
          department_id,
          status,
          profiles:profiles(email, last_sign_in_at),
          departments:departments(name, color)
        `)
        .eq('client_id', clientId);

      if (error) {
        console.error('[ClientUsersManagement] Error loading client_users:', error);
        setError('Failed to load users');
        setUsers([]);
        setLoading(false);
        return;
      }

      const userIds = (clientUsers || []).map(u => u.user_id);
      const rolesByUser: Record<string, { role_id: string | null; has_overrides: boolean; permissions: Record<string, any> }> = {};

      if (userIds.length > 0) {
        const { data: permRows } = await supabase
          .from('client_user_agent_permissions')
          .select('user_id, role_id, has_overrides, permissions, agent_id')
          .eq('client_id', clientId)
          .in('user_id', userIds);

        const seenUsers = new Set<string>();
        const allPermsByUser: Record<string, Record<string, any>> = {};
        (permRows || []).forEach((r: any) => {
          if (!seenUsers.has(r.user_id)) {
            seenUsers.add(r.user_id);
            rolesByUser[r.user_id] = {
              role_id: r.role_id,
              has_overrides: r.has_overrides || false,
              permissions: r.permissions || {},
            };
          }
          if (!allPermsByUser[r.user_id]) allPermsByUser[r.user_id] = {};
          allPermsByUser[r.user_id][r.agent_id] = r.permissions || {};
        });

        const roleIds = [...new Set(Object.values(rolesByUser).map(r => r.role_id).filter(Boolean))] as string[];
        let roleMap: Record<string, ClientRole> = {};
        if (roleIds.length > 0) {
          const { data: rolesData } = await supabase.from('client_roles').select('*').in('id', roleIds);
          (rolesData || []).forEach((r: any) => { roleMap[r.id] = r; });
        }

        const usersWithRoles = (clientUsers || []).map(u => {
          const roleInfo = rolesByUser[u.user_id] || { role_id: null, has_overrides: false, permissions: {} };
          const role = roleInfo.role_id ? roleMap[roleInfo.role_id] : null;
          return {
            id: u.id,
            status: (u as any).status || 'active',
            user_id: u.user_id,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            department_id: u.department_id,
            profiles: u.profiles || { email: '' },
            departments: u.departments || undefined,
            role_id: roleInfo.role_id || null,
            role_name: role?.name || null,
            role_slug: role?.slug || null,
            is_admin_tier: role?.is_admin_tier || false,
            has_overrides: roleInfo.has_overrides || false,
            agent_permissions: allPermsByUser[u.user_id] || {},
          };
        });

        setUsers(usersWithRoles);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('[ClientUsersManagement] Fatal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('client_id', clientId)
        .order('is_global', { ascending: false })
        .order('sort_order')
        .order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (error: any) {
      console.error('[ClientUsersManagement] Error in loadDepartments:', error);
    }
  };

  const loadAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('agent_assignments')
        .select(`
          agent_id,
          sort_order,
          agents (
            id,
            name,
            provider
          )
        `)
        .eq('client_id', clientId)
        .order('sort_order', { ascending: true });

      if (error) {
        setAgents([]);
        return;
      }
      
      const agentsList = data
        ?.map(a => ({
          id: (a.agents as any).id,
          name: (a.agents as any).name,
          provider: (a.agents as any).provider,
          sort_order: a.sort_order
        }))
        .filter(a => a.id) || [];

      setAgents(agentsList);

      // Permissions will be populated when role is selected via populatePermissionsFromRole
      // Set empty defaults initially
      const initialPermissions: Record<string, AgentPermission> = {};
      agentsList.forEach(agent => {
        initialPermissions[agent.id] = {
          agent_id: agent.id,
          analytics: false, conversations: false, transcripts: false,
          knowledge_base: false, agent_settings: false, specs: false, guides: false,
        };
      });
      setNewUserAgentPermissions(initialPermissions);
    } catch (error: any) {
      console.error('[ClientUsersManagement] Error in loadAgents:', error);
      setAgents([]);
    }
  };

  const loadUserAgentPermissions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_user_agent_permissions')
        .select('agent_id, permissions')
        .eq('user_id', userId)
        .eq('client_id', clientId);

      if (error) throw error;

      const permissions: Record<string, AgentPermission> = {};
      data?.forEach(p => {
        permissions[p.agent_id] = {
          agent_id: p.agent_id,
          ...(p.permissions as any),
        };
      });

      setSelectedUserAgentPermissions(permissions);

      // Track which agents the user has access to
      const access: Record<string, boolean> = {};
      agents.forEach(a => {
        access[a.id] = !!permissions[a.id];
      });
      setSelectedUserAgentAccess(access);
    } catch (error: any) {
      console.error('Error loading user permissions:', error);
    }
  };

  const loadUserClientPermissions = async (userId: string) => {
    const { data } = await supabase
      .from("client_user_permissions")
      .select("client_permissions, role_id")
      .eq("user_id", userId)
      .eq("client_id", clientId)
      .maybeSingle();
    setSelectedUserClientPerms((data?.client_permissions || {}) as Record<string, boolean>);
  };

  const handleAddUser = async () => {
    try {
      const nameParts = newUserFullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
      
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          clientId,
          email: newUserEmail,
          firstName,
          lastName,
          role: roles.find(r => r.id === newUserRoleId)?.is_admin_tier ? 'admin' : 'user',
          roleId: newUserRoleId,
          departmentId: newUserDepartment === "none" ? null : newUserDepartment || null,
          avatarUrl: newUserAvatar || null,
          pagePermissions: null,
        },
      });

      if (error) throw error;
      if (!data?.success || !data?.userId) {
        throw new Error(data?.error || 'create-client-user did not return a userId');
      }

      // N27: the EF already inserted a `client_user_agent_permissions` row for
      // every agent assigned to the client (seeded from the role template) and
      // a `client_user_permissions` row. We reconcile here:
      //  - DELETE rows for agents the admin unchecked.
      //  - UPDATE rows where the admin customised perms; mark has_overrides
      //    only when the custom values actually differ from the template.
      //  - Leave untouched rows where admin kept template defaults (EF row is
      //    already correct).
      const permKeys: (keyof AgentPermission)[] = [
        'conversations', 'transcripts', 'analytics', 'specs',
        'knowledge_base', 'guides', 'agent_settings',
      ];
      const templates = newUserRoleId ? await loadRoleTemplates(newUserRoleId) : {};
      const reconcileErrors: string[] = [];

      for (const agent of agents) {
        const hasAccess = newUserAgentAccess[agent.id] !== false;
        if (!hasAccess) {
          const { error: delErr } = await supabase
            .from('client_user_agent_permissions')
            .delete()
            .eq('user_id', data.userId)
            .eq('agent_id', agent.id)
            .eq('client_id', clientId);
          if (delErr) reconcileErrors.push(`${agent.name}: ${delErr.message}`);
          continue;
        }

        const custom = newUserAgentPermissions[agent.id];
        if (!custom) continue;
        const template = (templates[agent.id] || {}) as Record<string, any>;
        const hasOverrides = permKeys.some(k => (custom as any)[k] !== (template[k] || false));
        if (!hasOverrides) continue; // EF row already matches template

        const { error: updErr } = await supabase
          .from('client_user_agent_permissions')
          .update({
            has_overrides: true,
            permissions: permKeys.reduce((acc, k) => {
              acc[k] = (custom as any)[k] || false;
              return acc;
            }, {} as Record<string, boolean>),
          })
          .eq('user_id', data.userId)
          .eq('agent_id', agent.id)
          .eq('client_id', clientId);
        if (updErr) reconcileErrors.push(`${agent.name}: ${updErr.message}`);
      }

      if (reconcileErrors.length > 0) {
        toast({
          title: "User created with permission errors",
          description: `User created but some permissions could not be applied: ${reconcileErrors.join('; ')}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Success", description: "User created. A password setup email has been sent to their email address." });
      }

      loadUsers();
      setOpen(false);
      setNewUserEmail("");
      setNewUserFullName("");
      setNewUserDepartment("none");
      setNewUserAvatar("");

      const defaultRole = roles.find(r => r.is_default) || roles.find(r => !r.is_admin_tier);
      setNewUserRoleId(defaultRole?.id || "");
      if (defaultRole) {
        populatePermissionsFromRole(defaultRole.id);
      }
    } catch (error: any) {
      console.error('[ClientUsersManagement] User creation failed:', error);
      toast({
        title: "Error Creating User",
        description: error.message || 'Failed to create user. Please try again.',
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove) return;
    try {
      const { error } = await supabase
        .from('client_users')
        .update({ status: 'removed' })
        .eq('id', userToRemove.id);

      if (error) throw error;

      toast({ title: "Removed", description: "User has been removed. Their conversation history is preserved." });
      loadUsers();
      setRemoveDialogOpen(false);
      setUserToRemove(null);
      setExpandedUserId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSuspendUser = async (user: ClientUser) => {
    try {
      const { error } = await supabase
        .from('client_users')
        .update({ status: 'suspended' })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: "Suspended", description: `${user.full_name || 'User'} has been suspended and cannot log in.` });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleReactivateUser = async (user: ClientUser) => {
    try {
      const { error } = await supabase
        .from('client_users')
        .update({ status: 'active' })
        .eq('id', user.id);
      if (error) throw error;
      toast({ title: "Reactivated", description: `${user.full_name || 'User'} is now active again.` });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };


  const toggleAgentPermission = (agentId: string, field: keyof AgentPermission, value: boolean, isNewUser: boolean = true) => {
    if (isNewUser) {
      setNewUserAgentPermissions(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], [field]: value },
      }));
    } else {
      setSelectedUserAgentPermissions(prev => ({
        ...prev,
        [agentId]: { ...prev[agentId], [field]: value },
      }));
    }
  };

  const countOverrides = (user: ClientUser): number => {
    if (!user.has_overrides) return 0;
    let count = 0;
    const templates = roleTemplates[user.user_id] || {};
    for (const [agentId, perms] of Object.entries(user.agent_permissions)) {
      const template = templates[agentId] || {};
      Object.keys(perms).forEach(k => {
        if ((perms as any)[k] !== (template[k] ?? false)) count++;
      });
    }
    return count;
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-16 bg-muted rounded"></div>
          <div className="h-16 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Loading Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => { setError(null); setLoading(true); loadUsers(); }} className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Team Members</h2>
            <p className="text-sm text-muted-foreground">Manage users and their permissions</p>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-removed"
                  checked={showRemovedUsers}
                  onCheckedChange={setShowRemovedUsers}
                />
                <Label htmlFor="show-removed" className="text-xs text-muted-foreground">Show removed users</Label>
              </div>
              <Button onClick={() => setOpen(true)} className="bg-foreground text-background hover:bg-foreground/90">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          )}
        </div>

        {selectedUserIds.size > 0 && !readOnly && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-muted/50 rounded-lg flex-wrap">
            <span className="text-sm font-medium">{selectedUserIds.size} selected</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">Assign dept</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {departments.map(d => (
                    <button
                      key={d.id}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                      onClick={() => bulkAssignDept(d.id)}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (d as any).color || '#6B7280' }} />
                      {d.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">Change role</Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <div className="space-y-1">
                  {roles.map(r => (
                    <button
                      key={r.id}
                      className="w-full px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                      onClick={() => bulkChangeRole(r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="text-xs text-amber-600" onClick={bulkSuspend}>Suspend</Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearSelection}>Clear</Button>
          </div>
        )}

        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users assigned to this client yet.
          </div>
        ) : (
          <div className="space-y-2">
            {users
              .filter(user => {
                if (user.status === 'removed') return showRemovedUsers;
                return true;
              })
              .map((user) => {
              const isExpanded = expandedUserId === user.user_id;

              return (
                <div
                  key={user.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${isExpanded ? 'border-border' : 'border-border/50'}`}
                >
                  {/* User card row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => openUserOverlay(user)}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded shrink-0"
                      checked={selectedUserIds.has(user.id)}
                      onClick={(e) => toggleUserSelection(user.id, e)}
                      onChange={() => {}}
                      style={{ accentColor: 'hsl(var(--primary))' }}
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{user.full_name || "Unnamed"}</span>
                        {user.role_name && (
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full",
                            user.is_admin_tier
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          )}>
                            {user.role_name}
                          </span>
                        )}
                        {user.status === 'suspended' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Suspended</span>
                        )}
                        {user.status === 'removed' && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Removed</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground block">
                        {user.profiles?.email || 'No email'} · {formatLastActive(user.profiles?.last_sign_in_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(userDepts[user.id] || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map(d => (
                        <span key={d.junction_id} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${d.color}40`, color: d.color, backgroundColor: `${d.color}15` }}>
                          {d.name}
                        </span>
                      ))}
                      {(userDepts[user.id] || []).length === 0 && (
                        <span className="text-[10px] text-muted-foreground/50">No depts</span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        supabase.auth.signInWithOtp({
                          email: user.profiles?.email || '',
                          options: { shouldCreateUser: false },
                        }).then(({ error }) => {
                          if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                          else toast({ title: "Sent", description: "Login link sent to " + (user.profiles?.email || "user") });
                        });
                      }}
                    >
                      <Send className="h-3 w-3" />
                      Login
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        openUserOverlay(user);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* User settings overlay */}
                  <Dialog open={isExpanded && overlayUser?.user_id === user.user_id} onOpenChange={(open) => { if (!open) { setOverlayUser(null); setExpandedUserId(null); } }}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>User settings</DialogTitle>
                      </DialogHeader>

                      {/* Profile section */}
                      <div className="flex items-start gap-4 pb-4 border-b border-border">
                        <Avatar className="h-14 w-14">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-sm">{getInitials(user.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">First name</Label>
                              <Input
                                className="h-9 text-sm"
                                defaultValue={user.full_name?.split(' ')[0] || ''}
                                onBlur={async (e) => {
                                  const firstName = e.target.value.trim();
                                  const lastName = user.full_name?.split(' ').slice(1).join(' ') || '';
                                  const newFullName = `${firstName} ${lastName}`.trim();
                                  if (newFullName === user.full_name) return;
                                  await supabase.from('client_users').update({ full_name: newFullName }).eq('id', user.id);
                                  await supabase.from('profiles').update({ full_name: newFullName }).eq('id', user.user_id);
                                  loadUsers();
                                }}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Last name</Label>
                              <Input
                                className="h-9 text-sm"
                                defaultValue={user.full_name?.split(' ').slice(1).join(' ') || ''}
                                onBlur={async (e) => {
                                  const firstName = user.full_name?.split(' ')[0] || '';
                                  const lastName = e.target.value.trim();
                                  const newFullName = `${firstName} ${lastName}`.trim();
                                  if (newFullName === user.full_name) return;
                                  await supabase.from('client_users').update({ full_name: newFullName }).eq('id', user.id);
                                  await supabase.from('profiles').update({ full_name: newFullName }).eq('id', user.user_id);
                                  loadUsers();
                                }}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <Input
                              className="h-9 text-sm"
                              defaultValue={user.profiles?.email || ''}
                              onBlur={async (e) => {
                                const newEmail = e.target.value.trim();
                                if (!newEmail || newEmail === user.profiles?.email) return;
                                try {
                                  const { data, error: fnError } = await supabase.functions.invoke('update-user-email', {
                                    body: { userId: user.user_id, newEmail },
                                  });
                                  if (fnError || !data?.success) throw new Error(data?.error || fnError?.message || 'Failed to update email');
                                  toast({ title: "Email updated", description: `Email changed to ${newEmail}` });
                                  loadUsers();
                                } catch (err: any) {
                                  toast({ title: "Error", description: err.message, variant: "destructive" });
                                  e.target.value = user.profiles?.email || '';
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {readOnly && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                          View only — you don't have manage permissions.
                        </div>
                      )}
                      {/* Role + Department dropdowns */}
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">Role</Label>
                          <Select
                            value={user.role_id || ""}
                            onValueChange={(newRoleId) => {
                              if (readOnly) return;
                              if (newRoleId !== user.role_id) {
                                setRoleChangeModal({ user, newRoleId });
                              }
                            }}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {roles.map(r => (
                                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">Departments</Label>
                          <div className="flex items-center gap-1.5 flex-wrap min-h-[36px] px-2 py-1.5 border rounded-md bg-background">
                            {(userDepts[user.id] || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map(d => (
                              <span key={d.junction_id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${d.color}40`, color: d.color, backgroundColor: `${d.color}15` }}>
                                {d.name}
                                {!readOnly && (
                                  <button onClick={() => removeUserDept(d.junction_id)} className="hover:opacity-70">
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                            {!readOnly && (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:bg-muted/50">
                                    <Plus className="h-3 w-3" />
                                    Add
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="start">
                                  <div className="space-y-1">
                                    {departments
                                      .filter(d => !(userDepts[user.id] || []).some(ud => ud.department_id === d.id))
                                      .map(d => (
                                        <button
                                          key={d.id}
                                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
                                          onClick={() => addUserDept(user.id, d.id)}
                                        >
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (d as any).color || '#6B7280' }} />
                                          {d.name}
                                        </button>
                                      ))}
                                    {departments.filter(d => !(userDepts[user.id] || []).some(ud => ud.department_id === d.id)).length === 0 && (
                                      <p className="text-xs text-muted-foreground text-center py-2">All departments assigned</p>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Page access grid */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Agent access</span>
                          {user.has_overrides && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                              overrides from role
                            </span>
                          )}
                        </div>
                        {agents.map(agent => {
                          const agentConfig = agentCeilings[agent.id] || {};
                          const hasAccess = selectedUserAgentAccess[agent.id] ?? !!selectedUserAgentPermissions[agent.id];
                          const userPerms = selectedUserAgentPermissions[agent.id] || {};
                          const templatePerms = roleTemplates[user.user_id]?.[agent.id] || {};

                          const PERM_KEYS = [
                            { key: "conversations", label: "Conversations" },
                            { key: "transcripts", label: "Transcripts" },
                            { key: "analytics", label: "Analytics" },
                            { key: "specs", label: "Specifications" },
                            { key: "knowledge_base", label: "Knowledge base" },
                            { key: "guides", label: "Guides" },
                            { key: "agent_settings", label: "Agent settings" },
                          ];

                          const visibleKeys = PERM_KEYS.filter(p => {
                            const ceilingKey = "client_" + p.key + "_enabled";
                            return agentConfig[ceilingKey] !== false;
                          });

                          return (
                            <div key={agent.id} className="mb-2">
                              <div
                                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                                  hasAccess ? 'bg-muted/50 cursor-pointer hover:bg-muted' : 'bg-muted/30 opacity-60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded"
                                  checked={hasAccess}
                                  onChange={e => {
                                    if (readOnly) return;
                                    const newAccess = { ...selectedUserAgentAccess, [agent.id]: e.target.checked };
                                    setSelectedUserAgentAccess(newAccess);
                                    if (e.target.checked && !selectedUserAgentPermissions[agent.id]) {
                                      setSelectedUserAgentPermissions(prev => ({
                                        ...prev,
                                        [agent.id]: {
                                          agent_id: agent.id,
                                          conversations: templatePerms.conversations || false,
                                          transcripts: templatePerms.transcripts || false,
                                          analytics: templatePerms.analytics || false,
                                          specs: templatePerms.specs || false,
                                          knowledge_base: templatePerms.knowledge_base || false,
                                          guides: templatePerms.guides || false,
                                          agent_settings: templatePerms.agent_settings || false,
                                        },
                                      }));
                                    }
                                  }}
                                  style={{ accentColor: 'hsl(var(--primary))' }}
                                />
                                <span className="text-sm font-medium flex-1">{agent.name}</span>
                                <span className="text-[11px] text-muted-foreground">{agent.provider}</span>
                                {!hasAccess && <span className="text-[11px] text-muted-foreground">no access</span>}
                              </div>

                              {hasAccess && visibleKeys.length > 0 && (
                                <div className="pl-8 pt-1.5 pb-1">
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {visibleKeys.map(p => {
                                      const isChecked = (userPerms as any)[p.key] ?? templatePerms[p.key] ?? false;
                                      const isOverride = user.has_overrides && (userPerms as any)[p.key] !== undefined && (userPerms as any)[p.key] !== (templatePerms[p.key] ?? false);

                                      return (
                                        <label
                                          key={p.key}
                                          className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                                            isOverride
                                              ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                                              : 'bg-muted/50 hover:bg-muted'
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              if (readOnly) return;
                                              toggleAgentPermission(agent.id, p.key as keyof AgentPermission, e.target.checked, false);
                                            }}
                                            style={{ accentColor: isOverride ? '#B45309' : undefined }}
                                          />
                                          <span>{p.label}</span>
                                          {isOverride && (
                                            <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-auto">override</span>
                                          )}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Company settings section */}
                      {clientCaps['settings_page_enabled'] !== false && (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company settings</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updated: Record<string, boolean> = { ...selectedUserClientPerms, settings_page: true };
                                  COMPANY_SETTINGS_TABS.filter(t => clientCaps[t.capKey] !== false).forEach(t => {
                                    updated[t.key + '_view'] = true;
                                  });
                                  setSelectedUserClientPerms(updated);
                                }}
                              >
                                view all
                              </button>
                              <button
                                className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:bg-muted"
                                onClick={() => {
                                  const updated: Record<string, boolean> = { ...selectedUserClientPerms, settings_page: true };
                                  COMPANY_SETTINGS_TABS.filter(t => clientCaps[t.capKey] !== false && !t.viewOnly).forEach(t => {
                                    updated[t.key + '_manage'] = true;
                                  });
                                  setSelectedUserClientPerms(updated);
                                }}
                              >
                                manage all
                              </button>
                              <span className="text-[11px] text-muted-foreground">view / manage</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded"
                              checked={selectedUserClientPerms.settings_page || false}
                              onChange={e => setSelectedUserClientPerms(prev => ({ ...prev, settings_page: e.target.checked }))}
                            />
                            <span className="text-sm font-medium">Company settings page</span>
                          </div>

                          {selectedUserClientPerms.settings_page && (
                            <div className="space-y-1.5 pl-6">
                              {COMPANY_SETTINGS_TABS
                                .filter(tab => clientCaps[tab.capKey] !== false)
                                .map(tab => {
                                  const rolePerms = roles.find(r => r.id === user.role_id)?.client_permissions || {};
                                  const viewKey = tab.key + '_view';
                                  const manageKey = tab.key + '_manage';
                                  const viewChecked = selectedUserClientPerms[viewKey] ?? (rolePerms as any)[viewKey] ?? false;
                                  const manageChecked = selectedUserClientPerms[manageKey] ?? (rolePerms as any)[manageKey] ?? false;
                                  const viewIsOverride = selectedUserClientPerms[viewKey] !== undefined && selectedUserClientPerms[viewKey] !== ((rolePerms as any)[viewKey] ?? false);
                                  const manageIsOverride = !tab.viewOnly && selectedUserClientPerms[manageKey] !== undefined && selectedUserClientPerms[manageKey] !== ((rolePerms as any)[manageKey] ?? false);

                                  return (
                                    <div
                                      key={tab.key}
                                      className={`flex items-center justify-between px-3 py-2 rounded-md ${
                                        viewIsOverride || manageIsOverride
                                          ? 'bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                                          : 'bg-muted/50'
                                      }`}
                                    >
                                      <span className="text-sm">{tab.label}</span>
                                      <div className="flex gap-4">
                                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                          <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 rounded"
                                            checked={viewChecked}
                                            onChange={e => {
                                              if (readOnly) return;
                                              const updates = { ...selectedUserClientPerms, [viewKey]: e.target.checked };
                                              if (!e.target.checked) {
                                                updates[manageKey] = false;
                                              }
                                              setSelectedUserClientPerms(updates);
                                            }}
                                            style={{ accentColor: viewIsOverride ? '#B45309' : undefined }}
                                          />
                                          view
                                          {viewIsOverride && <span className="text-[10px] text-amber-600 dark:text-amber-400">override</span>}
                                        </label>
                                        {tab.viewOnly ? (
                                          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
                                            <input type="checkbox" className="w-3.5 h-3.5 rounded opacity-30" disabled />
                                            manage
                                          </label>
                                        ) : (
                                          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                                            <input
                                              type="checkbox"
                                              className="w-3.5 h-3.5 rounded"
                                              checked={manageChecked}
                                                onChange={e => {
                                                  if (readOnly) return;
                                                  const updates = { ...selectedUserClientPerms, [manageKey]: e.target.checked };
                                                  if (e.target.checked) {
                                                    updates[viewKey] = true;
                                                  }
                                                  setSelectedUserClientPerms(updates);
                                                }}
                                              style={{ accentColor: manageIsOverride ? '#B45309' : undefined }}
                                            />
                                            manage
                                            {manageIsOverride && <span className="text-[10px] text-amber-600 dark:text-amber-400">override</span>}
                                          </label>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      {!readOnly && (
                      <div className="flex items-center justify-between pt-2">
                        {user.has_overrides && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                            onClick={async () => {
                              if (!user.role_id) return;
                              const templates = await loadRoleTemplates(user.role_id);
                              for (const [agentId, perms] of Object.entries(templates)) {
                                await supabase
                                  .from('client_user_agent_permissions')
                                  .update({ permissions: perms, has_overrides: false })
                                  .eq('user_id', user.user_id)
                                  .eq('agent_id', agentId)
                                  .eq('client_id', clientId);
                              }
                              // Reset client-scoped permissions
                              const roleClientPerms = roles.find(r => r.id === user.role_id)?.client_permissions || {};
                              await supabase
                                .from('client_user_permissions')
                                .upsert({
                                  user_id: user.user_id,
                                  client_id: clientId,
                                  role_id: user.role_id,
                                  client_permissions: roleClientPerms,
                                  has_overrides: false,
                                }, { onConflict: 'user_id,client_id' });
                              setSelectedUserClientPerms(roleClientPerms as Record<string, boolean>);
                              toast({ title: "Reset", description: "Permissions reset to role defaults" });
                              loadUsers();
                              await loadUserAgentPermissions(user.user_id);
                            }}
                          >
                            Reset to role defaults
                          </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                          {userType === 'client' && !isPreviewMode && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                              disabled={isImpersonating}
                              onClick={async () => {
                                try {
                                  sessionStorage.setItem('impersonation_return_url', window.location.pathname + window.location.search);
                                  await startImpersonation({
                                    targetType: 'client_user',
                                    targetUserId: user.user_id,
                                    clientId: clientId,
                                  });
                                  window.location.href = '/';
                                } catch (e: any) {
                                  toast({ title: "Error", description: e.message, variant: "destructive" });
                                }
                              }}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View as
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={async () => {
                              try {
                                const { error } = await supabase.auth.signInWithOtp({
                                  email: user.profiles?.email || '',
                                  options: {
                                    shouldCreateUser: false,
                                  },
                                });
                                if (error) throw error;
                                toast({ title: "Sent", description: "Login link sent to " + (user.profiles?.email || "user") });
                              } catch (e: any) {
                                toast({ title: "Error", description: e.message, variant: "destructive" });
                              }
                            }}
                          >
                            Send login link
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={async () => {
                              try {
                                await supabase.functions.invoke('send-password-reset-email', {
                                  body: { userId: user.user_id },
                                });
                                toast({ title: "Sent", description: "Password reset email sent" });
                              } catch (e: any) {
                                toast({ title: "Error", description: e.message, variant: "destructive" });
                              }
                            }}
                          >
                            Reset password
                          </Button>
                          {user.status === 'active' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => handleSuspendUser(user)}
                            >
                              Suspend user
                            </Button>
                          )}
                          {user.status === 'suspended' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleReactivateUser(user)}
                            >
                              Reactivate
                            </Button>
                          )}
                          {user.status !== 'removed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { setUserToRemove(user); setRemoveDialogOpen(true); }}
                            >
                              Remove user
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                const errors: string[] = [];
                                // Save agent-scoped permissions
                                for (const agent of agents) {
                                  const hasAccess = selectedUserAgentAccess[agent.id] ?? !!selectedUserAgentPermissions[agent.id];
                                  const hadAccess = !!user.agent_permissions[agent.id];
                                  if (hasAccess && hadAccess) {
                                    const perms = selectedUserAgentPermissions[agent.id];
                                    if (perms) {
                                      const templatePerms = roleTemplates[user.user_id]?.[agent.id] || {};
                                      const { agent_id: _stripId, ...cleanPerms } = perms as any;
                                      const hasOverrides = Object.keys(cleanPerms).some(
                                        k => cleanPerms[k] !== (templatePerms[k] ?? false)
                                      );
                                      const { error } = await supabase
                                        .from('client_user_agent_permissions')
                                        .update({
                                          permissions: cleanPerms,
                                          has_overrides: hasOverrides,
                                        })
                                        .eq('user_id', user.user_id)
                                        .eq('agent_id', agent.id)
                                        .eq('client_id', clientId);
                                      if (error) errors.push(`Update ${agent.name}: ${error.message}`);
                                    }
                                  } else if (hasAccess && !hadAccess) {
                                    const perms = selectedUserAgentPermissions[agent.id];
                                    if (perms) {
                                      // F12 fix: was hardcoding has_overrides:false. If the
                                      // admin customised perms before granting access, those
                                      // values would persist but the resolver would treat
                                      // them as non-overrides and ignore them. Diff against
                                      // the role template the same way the UPDATE path does.
                                      const templatePerms = roleTemplates[user.user_id]?.[agent.id] || {};
                                      const insertPerms = {
                                        conversations: perms.conversations,
                                        transcripts: perms.transcripts,
                                        analytics: perms.analytics,
                                        specs: perms.specs,
                                        knowledge_base: perms.knowledge_base,
                                        guides: perms.guides,
                                        agent_settings: perms.agent_settings,
                                      };
                                      const hasOverrides = Object.keys(insertPerms).some(
                                        k => (insertPerms as any)[k] !== (templatePerms[k] ?? false)
                                      );
                                      const { error } = await supabase
                                        .from('client_user_agent_permissions')
                                        .insert({
                                          user_id: user.user_id,
                                          agent_id: agent.id,
                                          client_id: clientId,
                                          role_id: user.role_id,
                                          has_overrides: hasOverrides,
                                          permissions: insertPerms,
                                        });
                                      if (error) errors.push(`Grant ${agent.name}: ${error.message}`);
                                    }
                                  } else if (!hasAccess && hadAccess) {
                                    const { error } = await supabase
                                      .from('client_user_agent_permissions')
                                      .delete()
                                      .eq('user_id', user.user_id)
                                      .eq('agent_id', agent.id)
                                      .eq('client_id', clientId);
                                    if (error) errors.push(`Revoke ${agent.name}: ${error.message}`);
                                  }
                                }
                                // Save client-scoped permissions.
                                // F13 fix: previously set has_overrides to "any keys
                                // present" — a fresh save with no real changes would
                                // flag the user as overridden and surface a hollow
                                // "Reset to role defaults" button. Diff against the
                                // role's client_permissions template instead.
                                const roleClientTemplate = (roles.find(r => r.id === user.role_id)?.client_permissions || {}) as Record<string, boolean>;
                                const clientHasOverrides = Object.keys(selectedUserClientPerms).some(
                                  k => selectedUserClientPerms[k] !== (roleClientTemplate[k] ?? false)
                                );
                                const { error: clientPermError } = await supabase
                                  .from('client_user_permissions')
                                  .upsert({
                                    user_id: user.user_id,
                                    client_id: clientId,
                                    role_id: user.role_id,
                                    client_permissions: selectedUserClientPerms,
                                    has_overrides: clientHasOverrides,
                                  }, { onConflict: 'user_id,client_id' });
                                if (clientPermError) errors.push(`Company settings: ${clientPermError.message}`);
                                if (errors.length > 0) {
                                  toast({ title: "Error saving permissions", description: errors.join('. '), variant: "destructive" });
                                } else {
                                  toast({ title: "Saved", description: "User permissions updated" });
                                }
                                loadUsers();
                              } catch (error: any) {
                                toast({ title: "Error", description: error.message || "Failed to save permissions", variant: "destructive" });
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add User Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Profile section — matching overlay format */}
            <div className="flex items-start gap-4 pb-4 border-b border-border">
              <AvatarUpload
                currentUrl={newUserAvatar}
                onUploadComplete={(url) => setNewUserAvatar(url)}
              />
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Full Name</Label>
                    <Input
                      className="h-9 text-sm"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    className="h-9 text-sm"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Role + Department — matching overlay format */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={newUserRoleId} onValueChange={(value) => {
                  setNewUserRoleId(value);
                  populatePermissionsFromRole(value);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.is_system ? " (system)" : ""}{r.is_default ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {roles.find(r => r.id === newUserRoleId)?.is_admin_tier
                    ? "Full access to all agency-enabled features"
                    : "Permissions auto-populated from role template"}
                </p>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Agent permissions — keeping existing logic */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Agent Access</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.map((agent) => {
                  const perms = newUserAgentPermissions[agent.id];
                  const hasAccess = newUserAgentAccess[agent.id] ?? !!perms;

                  return (
                    <div key={agent.id} className="border rounded p-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={hasAccess}
                          onCheckedChange={(checked) => {
                            setNewUserAgentAccess(prev => ({ ...prev, [agent.id]: !!checked }));
                            if (checked && !perms) {
                              populatePermissionsFromRole(newUserRoleId);
                            }
                          }}
                        />
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{agent.provider}</span>
                      </label>
                      {hasAccess && perms && (
                        <div className="grid grid-cols-2 gap-2 text-sm pl-6">
                          {[
                            { key: 'conversations', label: 'Conversations' },
                            { key: 'transcripts', label: 'Transcripts' },
                            { key: 'analytics', label: 'Analytics' },
                            { key: 'specs', label: 'Specifications' },
                            { key: 'knowledge_base', label: 'Knowledge base' },
                            { key: 'guides', label: 'Guides' },
                            { key: 'agent_settings', label: 'Agent settings' },
                          ].filter(p => {
                            const config = agentCeilings[agent.id] || {};
                            return config['client_' + p.key + '_enabled'] !== false;
                          }).map(p => (
                            <label key={p.key} className="flex items-center gap-2">
                              <Checkbox
                                checked={(perms as any)[p.key] || false}
                                onCheckedChange={(checked) => toggleAgentPermission(agent.id, p.key as keyof AgentPermission, checked as boolean)}
                              />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAddUser} disabled={!newUserEmail || !newUserFullName}>Add User</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Change Confirmation */}
      <AlertDialog open={!!roleChangeModal} onOpenChange={() => setRoleChangeModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role</AlertDialogTitle>
            <AlertDialogDescription>
              Change {roleChangeModal?.user.full_name}'s role to {roles.find(r => r.id === roleChangeModal?.newRoleId)?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                if (!roleChangeModal) return;
                const { user, newRoleId } = roleChangeModal;
                const errors: string[] = [];
                const isExpanded = expandedUserId === user.user_id;

                // Update agent-scoped permission rows: new role_id, mark as overrides
                // (since existing perms may differ from new role's template).
                const { error: agentUpdateErr } = await supabase
                  .from('client_user_agent_permissions')
                  .update({ role_id: newRoleId, has_overrides: true })
                  .eq('user_id', user.user_id)
                  .eq('client_id', clientId);
                if (agentUpdateErr) errors.push(`Agent perms: ${agentUpdateErr.message}`);

                // Persist any in-memory agent-permission edits the admin made
                // before triggering the role change (only if this user's panel
                // is expanded — otherwise the in-memory state isn't theirs).
                if (isExpanded) {
                  for (const agent of agents) {
                    const perms = selectedUserAgentPermissions[agent.id];
                    if (!perms) continue;
                    const { agent_id: _stripId, ...cleanPerms } = perms as any;
                    const { error: e } = await supabase
                      .from('client_user_agent_permissions')
                      .update({ permissions: cleanPerms })
                      .eq('user_id', user.user_id)
                      .eq('agent_id', agent.id)
                      .eq('client_id', clientId);
                    if (e) errors.push(`Agent ${agent.name}: ${e.message}`);
                  }
                }

                // Update client-scoped permission row: new role_id, mark as
                // overrides, and persist current client_permissions (in-memory
                // if expanded, otherwise whatever's in DB stays via upsert with
                // the new role_id but old client_permissions).
                const newClientPerms = isExpanded
                  ? selectedUserClientPerms
                  : (await supabase
                      .from('client_user_permissions')
                      .select('client_permissions')
                      .eq('user_id', user.user_id)
                      .eq('client_id', clientId)
                      .maybeSingle()).data?.client_permissions || {};
                const { error: clientPermErr } = await supabase
                  .from('client_user_permissions')
                  .upsert({
                    user_id: user.user_id,
                    client_id: clientId,
                    role_id: newRoleId,
                    client_permissions: newClientPerms,
                    has_overrides: true,
                  }, { onConflict: 'user_id,client_id' });
                if (clientPermErr) errors.push(`Client perms: ${clientPermErr.message}`);

                setRoleChangeModal(null);
                await loadUserAgentPermissions(user.user_id);
                await loadUserClientPermissions(user.user_id);
                const updatedTemplates = await loadRoleTemplates(newRoleId);
                setRoleTemplates(prev => ({ ...prev, [user.user_id]: updatedTemplates }));
                setUsers(prev => prev.map(u =>
                  u.user_id === user.user_id
                    ? { ...u, role_id: newRoleId, role_name: roles.find(r => r.id === newRoleId)?.name || null, role_slug: roles.find(r => r.id === newRoleId)?.slug || null, is_admin_tier: roles.find(r => r.id === newRoleId)?.is_admin_tier || false }
                    : u
                ));

                if (errors.length > 0) {
                  toast({ title: "Role changed with errors", description: errors.join('. '), variant: "destructive" });
                } else {
                  toast({ title: "Role changed", description: "Kept current permissions as overrides" });
                }
              }}
            >
              Keep current permissions
            </Button>
            <AlertDialogAction
              onClick={async () => {
                if (!roleChangeModal) return;
                const { user, newRoleId } = roleChangeModal;
                const errors: string[] = [];
                const templates = await loadRoleTemplates(newRoleId);

                // First, update role_id on ALL of this user's agent-scoped rows
                const { error: roleIdErr } = await supabase
                  .from('client_user_agent_permissions')
                  .update({ role_id: newRoleId })
                  .eq('user_id', user.user_id)
                  .eq('client_id', clientId);
                if (roleIdErr) errors.push(`Agent role_id: ${roleIdErr.message}`);

                // Then update permissions for each agent that has a template
                for (const [agentId, perms] of Object.entries(templates)) {
                  const { error: e } = await supabase
                    .from('client_user_agent_permissions')
                    .update({ permissions: perms, has_overrides: false })
                    .eq('user_id', user.user_id)
                    .eq('agent_id', agentId)
                    .eq('client_id', clientId);
                  if (e) errors.push(`Agent ${agentId}: ${e.message}`);
                }

                // For agents WITHOUT a template, reset to all-false
                const templateAgentIds = Object.keys(templates);
                const allAgentIds = agents.map(a => a.id);
                const untemplatedAgentIds = allAgentIds.filter(id => !templateAgentIds.includes(id));

                for (const agentId of untemplatedAgentIds) {
                  const { error: e } = await supabase
                    .from('client_user_agent_permissions')
                    .update({
                      permissions: {
                        conversations: false, transcripts: false, analytics: false,
                        specs: false, knowledge_base: false, guides: false, agent_settings: false,
                      },
                      has_overrides: false,
                    })
                    .eq('user_id', user.user_id)
                    .eq('agent_id', agentId)
                    .eq('client_id', clientId);
                  if (e) errors.push(`Agent ${agentId}: ${e.message}`);
                }

                // Reset client-scoped row: new role_id, new role's client defaults,
                // and clear has_overrides. Without this, role_id on the
                // client_user_permissions row was orphaned to the OLD role.
                const newRoleClientPerms = roles.find(r => r.id === newRoleId)?.client_permissions || {};
                const { error: clientPermErr } = await supabase
                  .from('client_user_permissions')
                  .upsert({
                    user_id: user.user_id,
                    client_id: clientId,
                    role_id: newRoleId,
                    client_permissions: newRoleClientPerms,
                    has_overrides: false,
                  }, { onConflict: 'user_id,client_id' });
                if (clientPermErr) errors.push(`Client perms: ${clientPermErr.message}`);

                setRoleChangeModal(null);
                await loadUserAgentPermissions(user.user_id);
                await loadUserClientPermissions(user.user_id);
                const updatedTemplates2 = await loadRoleTemplates(newRoleId);
                setRoleTemplates(prev => ({ ...prev, [user.user_id]: updatedTemplates2 }));
                setUsers(prev => prev.map(u =>
                  u.user_id === user.user_id
                    ? { ...u, role_id: newRoleId, role_name: roles.find(r => r.id === newRoleId)?.name || null, role_slug: roles.find(r => r.id === newRoleId)?.slug || null, is_admin_tier: roles.find(r => r.id === newRoleId)?.is_admin_tier || false }
                    : u
                ));

                if (errors.length > 0) {
                  toast({ title: "Role changed with errors", description: errors.join('. '), variant: "destructive" });
                } else {
                  toast({ title: "Role changed", description: "Permissions reset to new role defaults" });
                }
              }}
            >
              Reset to defaults
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove User Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.full_name || 'this user'}? They will no longer be able to log in. Their conversation history and audit trail will be preserved. You can reinstate them later by adding a user with the same email address.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveUser}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
