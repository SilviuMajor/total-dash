import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useSuperAdminStatus } from "@/hooks/useSuperAdminStatus";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, Copy, AlertCircle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PasswordDisplay } from "@/components/PasswordDisplay";

interface ClientUser {
  id: string;
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
  };
  departments?: {
    name: string;
    color?: string;
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
  sort_order: number;
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

export function ClientUsersManagement({ clientId }: { clientId: string }) {
  const { isPreviewMode } = useMultiTenantAuth();
  const { isSuperAdmin, loading: isSuperAdminLoading } = useSuperAdminStatus();
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [roles, setRoles] = useState<ClientRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<ClientUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [roleChangeModal, setRoleChangeModal] = useState<{ user: ClientUser; newRoleId: string } | null>(null);
  const [roleTemplates, setRoleTemplates] = useState<Record<string, Record<string, any>>>({});
  const [agentCeilings, setAgentCeilings] = useState<Record<string, Record<string, any>>>({});
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState<string>("none");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserAvatar, setNewUserAvatar] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
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
  }, [clientId, isSuperAdmin, isSuperAdminLoading, isPreviewMode]);

  const loadRoles = async () => {
    const { data } = await supabase
      .from("client_roles")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order");
    setRoles((data || []) as ClientRole[]);
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
          profiles:profiles(email),
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

        const roleIds = [...new Set(Object.values(rolesByUser).map(r => r.role_id).filter(Boolean))];
        let roleMap: Record<string, ClientRole> = {};
        if (roleIds.length > 0) {
          const { data: rolesData } = await supabase.from('client_roles').select('*').in('id', roleIds);
          (rolesData || []).forEach((r: any) => { roleMap[r.id] = r; });
        }

        const usersWithRoles = (clientUsers || []).map(u => {
          const roleInfo = rolesByUser[u.user_id] || {};
          const role = roleInfo.role_id ? roleMap[roleInfo.role_id] : null;
          return {
            id: u.id,
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

      const initialPermissions: Record<string, AgentPermission> = {};
      agentsList.forEach(agent => {
        initialPermissions[agent.id] = {
          agent_id: agent.id,
          analytics: true,
          conversations: true,
          transcripts: true,
          knowledge_base: false,
          agent_settings: false,
          specs: true,
          guides: false,
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
    } catch (error: any) {
      console.error('Error loading user permissions:', error);
    }
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
          role: newUserRole,
          departmentId: newUserDepartment === "none" ? null : newUserDepartment || null,
          avatarUrl: newUserAvatar || null,
          pagePermissions: null,
          customPassword: newUserPassword || undefined,
        },
      });

      if (error) throw error;

      if (data.success && data.userId) {
        const activePermissions = Object.values(newUserAgentPermissions);
        for (const permission of activePermissions) {
          await supabase
            .from('client_user_agent_permissions')
            .insert({
              user_id: data.userId,
              agent_id: permission.agent_id,
              client_id: clientId,
              permissions: {
                analytics: permission.analytics,
                conversations: permission.conversations,
                transcripts: permission.transcripts,
                knowledge_base: permission.knowledge_base,
                agent_settings: permission.agent_settings,
                specs: permission.specs,
                guides: permission.guides,
              },
            });
        }
      }

      if (data.success) {
        setGeneratedPassword(data.temporaryPassword);
        toast({ title: "Success", description: "User created successfully" });
        loadUsers();
        setOpen(false);
        setNewUserEmail("");
        setNewUserFullName("");
        setNewUserRole("user");
        setNewUserDepartment("none");
        setNewUserAvatar("");
        setNewUserPassword("");
        
        const initialPermissions: Record<string, AgentPermission> = {};
        agents.forEach(agent => {
          initialPermissions[agent.id] = {
            agent_id: agent.id,
            analytics: true,
            conversations: true,
            transcripts: true,
            knowledge_base: false,
            agent_settings: false,
            specs: true,
            guides: false,
          };
        });
        setNewUserAgentPermissions(initialPermissions);
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
      await supabase
        .from('client_user_agent_permissions')
        .delete()
        .eq('user_id', userToRemove.user_id)
        .eq('client_id', clientId);

      await supabase
        .from('client_user_departments')
        .delete()
        .eq('client_user_id', userToRemove.id);

      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userToRemove.user_id)
        .eq('client_id', clientId);

      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('id', userToRemove.id);

      if (error) throw error;

      toast({ title: "Removed", description: "User removed successfully" });
      loadUsers();
      setRemoveDialogOpen(false);
      setUserToRemove(null);
      setExpandedUserId(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast({ title: "Copied", description: "Password copied to clipboard" });
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
          <Button onClick={() => setOpen(true)} className="bg-foreground text-background hover:bg-foreground/90">
            <UserPlus className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No users assigned to this client yet.
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => {
              const isExpanded = expandedUserId === user.user_id;

              return (
                <div
                  key={user.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${isExpanded ? 'border-border' : 'border-border/50'}`}
                >
                  {/* User header row */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={async () => {
                      if (isExpanded) {
                        setExpandedUserId(null);
                      } else {
                        setExpandedUserId(user.user_id);
                        await loadUserAgentPermissions(user.user_id);
                        if (user.role_id) {
                          const templates = await loadRoleTemplates(user.role_id);
                          setRoleTemplates(prev => ({ ...prev, [user.user_id]: templates }));
                        }
                      }
                    }}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{user.full_name || "Unnamed"}</span>
                      <span className="text-xs text-muted-foreground block">{user.profiles?.email || 'No email'}</span>
                    </div>
                    {user.role_name && (
                      <span className={`text-xs px-2.5 py-1 rounded-full ${
                        user.is_admin_tier
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}>
                        {user.role_name}
                      </span>
                    )}
                    {user.departments?.name && (
                      <span className="text-xs text-muted-foreground">{user.departments.name}</span>
                    )}
                    <PasswordDisplay userId={user.user_id} />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="border-t px-4 py-4 space-y-4">
                      {/* Role + Department dropdowns */}
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs text-muted-foreground">Role</Label>
                          <Select
                            value={user.role_id || ""}
                            onValueChange={(newRoleId) => {
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
                          <Label className="text-xs text-muted-foreground">Department</Label>
                          <Select
                            value={user.department_id || "none"}
                            onValueChange={async (value) => {
                              await supabase
                                .from('client_users')
                                .update({ department_id: value === "none" ? null : value })
                                .eq('id', user.id);
                              loadUsers();
                            }}
                          >
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

                      {/* Page access grid */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">Page access</span>
                          {user.has_overrides && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                              overrides from role
                            </span>
                          )}
                        </div>
                        {agents.map(agent => {
                          const agentConfig = agentCeilings[agent.id] || {};
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

                          if (visibleKeys.length === 0) return null;

                          return (
                            <div key={agent.id} className="mb-3">
                              {agents.length > 1 && (
                                <div className="text-xs font-medium text-muted-foreground mb-1.5">{agent.name}</div>
                              )}
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
                                        onChange={(e) => toggleAgentPermission(agent.id, p.key as keyof AgentPermission, e.target.checked, false)}
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
                          );
                        })}
                      </div>

                      {/* Action buttons */}
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
                              toast({ title: "Reset", description: "Permissions reset to role defaults" });
                              loadUsers();
                              await loadUserAgentPermissions(user.user_id);
                            }}
                          >
                            Reset to role defaults
                          </Button>
                        )}
                        <div className="flex gap-2 ml-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => { setUserToRemove(user); setRemoveDialogOpen(true); }}
                          >
                            Remove user
                          </Button>
                          <Button
                            size="sm"
                            onClick={async () => {
                              for (const [agentId, perms] of Object.entries(selectedUserAgentPermissions)) {
                                const templatePerms = roleTemplates[user.user_id]?.[agentId] || {};
                                const hasOverrides = Object.keys(perms).some(
                                  k => k !== 'agent_id' && (perms as any)[k] !== (templatePerms[k] ?? false)
                                );
                                await supabase
                                  .from('client_user_agent_permissions')
                                  .update({
                                    permissions: perms,
                                    has_overrides: hasOverrides,
                                  })
                                  .eq('user_id', user.user_id)
                                  .eq('agent_id', agentId)
                                  .eq('client_id', clientId);
                              }
                              toast({ title: "Saved", description: "User permissions updated" });
                              loadUsers();
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Leave empty to auto-generate"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={newUserDepartment} onValueChange={setNewUserDepartment}>
                <SelectTrigger id="department">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role">User Role</Label>
              <Select value={newUserRole} onValueChange={(value: 'admin' | 'user') => setNewUserRole(value)}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <AvatarUpload
              currentUrl={newUserAvatar}
              onUploadComplete={(url) => setNewUserAvatar(url)}
            />

            {/* Agent permissions */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Agent Permissions</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {agents.map((agent) => {
                  const perms = newUserAgentPermissions[agent.id];
                  if (!perms) return null;

                  return (
                    <div key={agent.id} className="border p-3 rounded space-y-2">
                      <div className="font-medium">{agent.name}</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.analytics}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'analytics', checked as boolean)}
                          />
                          Analytics
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.conversations}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'conversations', checked as boolean)}
                          />
                          Conversations
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.transcripts}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'transcripts', checked as boolean)}
                          />
                          Transcripts
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.knowledge_base}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'knowledge_base', checked as boolean)}
                          />
                          Knowledge Base
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.agent_settings}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'agent_settings', checked as boolean)}
                          />
                          Agent Settings
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.specs}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'specs', checked as boolean)}
                          />
                          Specs
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={perms.guides}
                            onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'guides', checked as boolean)}
                          />
                          Guides
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {generatedPassword && (
              <div className="p-4 bg-muted rounded space-y-2">
                <Label>Generated Password</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background rounded text-sm">
                    {generatedPassword}
                  </code>
                  <Button size="sm" onClick={copyPassword}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save this password. It won't be shown again.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  setGeneratedPassword("");
                }}
              >
                {generatedPassword ? "Done" : "Cancel"}
              </Button>
              {!generatedPassword && (
                <Button onClick={handleAddUser} disabled={!newUserEmail || !newUserFullName}>
                  Add User
                </Button>
              )}
            </div>
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
                await supabase
                  .from('client_user_agent_permissions')
                  .update({ role_id: newRoleId, has_overrides: true })
                  .eq('user_id', user.user_id)
                  .eq('client_id', clientId);
                toast({ title: "Role changed", description: "Kept current permissions as overrides" });
                setRoleChangeModal(null);
                loadUsers();
              }}
            >
              Keep current permissions
            </Button>
            <AlertDialogAction
              onClick={async () => {
                if (!roleChangeModal) return;
                const { user, newRoleId } = roleChangeModal;
                const templates = await loadRoleTemplates(newRoleId);
                for (const [agentId, perms] of Object.entries(templates)) {
                  await supabase
                    .from('client_user_agent_permissions')
                    .update({ permissions: perms, role_id: newRoleId, has_overrides: false })
                    .eq('user_id', user.user_id)
                    .eq('agent_id', agentId)
                    .eq('client_id', clientId);
                }
                toast({ title: "Role changed", description: "Permissions reset to new role defaults" });
                setRoleChangeModal(null);
                loadUsers();
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
              Are you sure you want to remove this user from the client? This action cannot be undone.
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
