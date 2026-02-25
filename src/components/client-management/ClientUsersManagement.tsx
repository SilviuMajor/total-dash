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
import { Settings, Trash2, UserPlus, Copy, AlertCircle, Loader2 } from "lucide-react";
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
  roles: string[];
  profiles: {
    email: string;
  };
  departments?: {
    name: string;
  };
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
}

export function ClientUsersManagement({ clientId }: { clientId: string }) {
  const { isPreviewMode } = useMultiTenantAuth();
  const { isSuperAdmin, loading: isSuperAdminLoading } = useSuperAdminStatus();
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<ClientUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState<string>("none");
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
  const [newUserAvatar, setNewUserAvatar] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAgentPermissions, setNewUserAgentPermissions] = useState<Record<string, AgentPermission>>({});
  const [selectedUserAgentPermissions, setSelectedUserAgentPermissions] = useState<Record<string, AgentPermission>>({});
  const [profileAccessControl, setProfileAccessControl] = useState({
    edit_name: 'all',
    change_email: 'admin_only',
    change_password: 'all',
  });

  const { toast } = useToast();

  // Safe helper for getting initials
  const getInitials = (name?: string | null, fallback?: string): string => {
    const src = name || fallback || "";
    if (!src.trim()) return "U";
    const parts = src.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  useEffect(() => {
    // Check authentication first
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return;
      }
    };
    
    checkAuth();
    
    // Wait for super admin status to be determined before loading
    if (isSuperAdminLoading) {
      return;
    }
    
    loadUsers();
    loadDepartments();
    loadAgents();
  }, [clientId, isSuperAdmin, isSuperAdminLoading, isPreviewMode]);

  useEffect(() => {
    loadProfileAccessSettings();
  }, [clientId]);

  const loadUsers = async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);

    try {
      const isSuperAdminPreview = isPreviewMode && isSuperAdmin === true;

      // If super admin preview, always use bypass function
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

        const usersWithRoles = (functionData?.users || []).map((u: any) => ({
          id: u.id,
          user_id: u.user_id,
          full_name: u.full_name,
          avatar_url: u.avatar_url,
          department_id: u.department_id,
          profiles: u.profiles || { email: '' },
          departments: u.departments || undefined,
          roles: u.roles || [],
        }));

        setUsers(usersWithRoles);
        setLoading(false);
        return;
      }

      // Normal path: direct RLS-governed queries
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

      // Fetch roles for these users
      const userIds = (clientUsers || []).map(u => u.user_id);
      let rolesByUser: Record<string, string[]> = {};
      
      if (userIds.length > 0) {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .eq('client_id', clientId)
          .in('user_id', userIds);

        if (!rolesError && roles) {
          rolesByUser = roles.reduce((acc, r) => {
            acc[r.user_id] = acc[r.user_id] || [];
            acc[r.user_id].push(r.role);
            return acc;
          }, {} as Record<string, string[]>);
        }
      }

      const usersWithRoles = (clientUsers || []).map(u => ({
        id: u.id,
        user_id: u.user_id,
        full_name: u.full_name,
        avatar_url: u.avatar_url,
        department_id: u.department_id,
        profiles: u.profiles || { email: '' },
        departments: u.departments || undefined,
        roles: rolesByUser[u.user_id] || [],
      }));

      setUsers(usersWithRoles);
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

      if (error) {
        console.error('[ClientUsersManagement] Error loading departments:', error);
        throw error;
      }
      setDepartments(data || []);
    } catch (error: any) {
      console.error('[ClientUsersManagement] Error in loadDepartments:', error);
      // Don't set error state for departments - it's not critical
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
        console.error('[ClientUsersManagement] Error loading agents:', error);
        // Don't throw - agents might not be accessible in preview mode
        // Just log and continue with empty agents list
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

      // Initialize permissions for new user
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

  const loadProfileAccessSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('client_settings')
        .select('profile_access_control')
        .eq('client_id', clientId)
        .single();

      if (error) throw error;
      if (data?.profile_access_control) {
        setProfileAccessControl(data.profile_access_control as any);
      }
    } catch (error: any) {
      console.error('Error loading profile access settings:', error);
    }
  };

  const updateAccessControl = async (field: string, value: string) => {
    try {
      const newAccessControl = {
        ...profileAccessControl,
        [field]: value,
      };

      const { error } = await supabase
        .from('client_settings')
        .update({ profile_access_control: newAccessControl })
        .eq('client_id', clientId);

      if (error) throw error;

      setProfileAccessControl(newAccessControl);
      toast({
        title: "Success",
        description: "Profile access settings updated",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleAddUser = async () => {
    try {
      // Parse fullName into firstName and lastName
      const nameParts = newUserFullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || nameParts[0];
      
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          clientId,
          email: newUserEmail,
          firstName: firstName,
          lastName: lastName,
          role: newUserRole,
          departmentId: newUserDepartment === "none" ? null : newUserDepartment || null,
          avatarUrl: newUserAvatar || null,
          pagePermissions: null,
          customPassword: newUserPassword || undefined,
        },
      });

      if (error) throw error;

      // Add agent permissions if user was created successfully
      if (data.success && data.userId) {
        const activePermissions = Object.values(newUserAgentPermissions);
        
        for (const permission of activePermissions) {
          const { error: permError } = await supabase
            .from('client_user_agent_permissions')
            .insert({
              user_id: data.userId,
              agent_id: permission.agent_id,
              client_id: clientId,
              permissions: {
                analytics: permission.analytics,
                conversations: permission.conversations,
                agent_settings: permission.agent_settings,
                knowledge_base: permission.knowledge_base,
              },
            });
          
          if (permError) {
            console.error('Error adding agent permission:', permError);
          }
        }
      }

      if (data.success) {
        setGeneratedPassword(data.temporaryPassword);
        toast({
          title: "Success",
          description: `User created successfully`,
        });
        loadUsers();
        setOpen(false);
        setNewUserEmail("");
        setNewUserFullName("");
        setNewUserRole("user");
        setNewUserDepartment("none");
        setNewUserAvatar("");
        setNewUserPassword("");
        
        // Reset permissions
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
          };
        });
        setNewUserAgentPermissions(initialPermissions);
      }
    } catch (error: any) {
      console.error('[ClientUsersManagement] User creation failed:', error);
      
      // Don't close dialog on error - let user fix the issue
      toast({
        title: "Error Creating User",
        description: error.message || 'Failed to create user. Please try again.',
        variant: "destructive",
      });
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;

    try {
      // Check if removing admin role from last admin
      const currentRoles = selectedUser.roles || [];
      const isCurrentlyAdmin = currentRoles.includes('admin');
      const willBeAdmin = selectedUser.roles.includes('admin');

      if (isCurrentlyAdmin && !willBeAdmin) {
        const { data: isLast } = await supabase.rpc('is_last_admin', {
          _user_id: selectedUser.user_id,
          _client_id: clientId
        });

        if (isLast) {
          toast({
            title: "Cannot Remove Admin",
            description: "This is the last admin user. At least one admin is required.",
            variant: "destructive",
          });
          return;
        }
      }

      // Update client_users basic info
      const { error: userError } = await supabase
        .from('client_users')
        .update({
          full_name: selectedUser.full_name,
          department_id: selectedUser.department_id || null,
          avatar_url: selectedUser.avatar_url,
        })
        .eq('id', selectedUser.id);

      if (userError) throw userError;

      // Update roles
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', selectedUser.user_id)
        .eq('client_id', clientId);

      if (selectedUser.roles.length > 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert(
            selectedUser.roles.map(role => ({
              user_id: selectedUser.user_id,
              client_id: clientId,
              role: role as 'admin' | 'user'
            }))
          );

        if (roleError) throw roleError;
      }

      // Delete existing permissions
      const { error: deleteError } = await supabase
        .from('client_user_agent_permissions')
        .delete()
        .eq('user_id', selectedUser.user_id)
        .eq('client_id', clientId);

      if (deleteError) throw deleteError;

      // Insert new permissions
      const permissionsToInsert = Object.values(selectedUserAgentPermissions).map(p => ({
        user_id: selectedUser.user_id,
        agent_id: p.agent_id,
        client_id: clientId,
        permissions: {
          analytics: p.analytics,
          conversations: p.conversations,
          transcripts: p.transcripts,
          knowledge_base: p.knowledge_base,
          agent_settings: p.agent_settings,
          specs: p.specs,
        },
      }));

      if (permissionsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('client_user_agent_permissions')
          .insert(permissionsToInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
      loadUsers();
      setPermissionsOpen(false);
      setSelectedUser(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async () => {
    if (!userToRemove) return;

    try {
      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('id', userToRemove.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from client successfully",
      });
      loadUsers();
      setRemoveDialogOpen(false);
      setUserToRemove(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast({
      title: "Copied",
      description: "Password copied to clipboard",
    });
  };

  const toggleAgentPermission = (agentId: string, field: keyof AgentPermission, value: boolean, isNewUser: boolean = true) => {
    if (isNewUser) {
      setNewUserAgentPermissions(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          [field]: value,
        },
      }));
    } else {
      setSelectedUserAgentPermissions(prev => ({
        ...prev,
        [agentId]: {
          ...prev[agentId],
          [field]: value,
        },
      }));
    }
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
      <Card className="p-6 bg-gradient-card border-border/50 mb-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Profile Access Settings
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Control which profile settings features are available to all users vs. admin-only
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Edit Name</Label>
              <p className="text-xs text-muted-foreground">Allow users to change their first/last name</p>
            </div>
            <Select
              value={profileAccessControl.edit_name}
              onValueChange={(value) => updateAccessControl('edit_name', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin_only">Admin Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Change Email</Label>
              <p className="text-xs text-muted-foreground">Allow users to change their email address</p>
            </div>
            <Select
              value={profileAccessControl.change_email}
              onValueChange={(value) => updateAccessControl('change_email', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin_only">Admin Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Change Password</Label>
              <p className="text-xs text-muted-foreground">Allow users to change their password</p>
            </div>
            <Select
              value={profileAccessControl.change_password}
              onValueChange={(value) => updateAccessControl('change_password', value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin_only">Admin Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Client Users</h2>
            <p className="text-sm text-muted-foreground">Manage users for this client</p>
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
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{user.full_name || "Unnamed User"}</p>
                    {user.roles.includes('admin') && <Badge variant="default">Admin</Badge>}
                    {user.departments?.name && <Badge variant="secondary">{user.departments.name}</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-sm mt-1">
                    <p className="text-muted-foreground truncate">{user.profiles?.email || 'No email'}</p>
                    <span className="text-muted-foreground">|</span>
                    <PasswordDisplay userId={user.user_id} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      setSelectedUser(user);
                      await loadUserAgentPermissions(user.user_id);
                      setPermissionsOpen(true);
                    }}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setUserToRemove(user);
                      setRemoveDialogOpen(true);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
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

      {/* Edit Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="editFullName">Full Name</Label>
                <Input
                  id="editFullName"
                  value={selectedUser.full_name || ""}
                  onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editDepartment">Department</Label>
                <Select
                  value={selectedUser.department_id || "none"}
                  onValueChange={(value) =>
                    setSelectedUser({ ...selectedUser, department_id: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger id="editDepartment">
                    <SelectValue />
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
                <Label htmlFor="editRole">User Role</Label>
                <Select
                  value={selectedUser.roles.includes('admin') ? 'admin' : 'user'}
                  onValueChange={(value) => {
                    setSelectedUser({ 
                      ...selectedUser, 
                      roles: value === 'admin' ? ['admin'] : ['user']
                    });
                  }}
                >
                  <SelectTrigger id="editRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Agent permissions */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Agent Permissions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {agents.map((agent) => {
                    const perms = selectedUserAgentPermissions[agent.id] || {
                      agent_id: agent.id,
                      analytics: false,
                      conversations: false,
                      transcripts: false,
                      knowledge_base: false,
                      agent_settings: false,
                      specs: false,
                    };

                    return (
                      <div key={agent.id} className="border p-3 rounded space-y-2">
                        <div className="font-medium">{agent.name}</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.analytics}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'analytics', checked as boolean, false)}
                            />
                            Analytics
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.conversations}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'conversations', checked as boolean, false)}
                            />
                            Conversations
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.transcripts}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'transcripts', checked as boolean, false)}
                            />
                            Transcripts
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.knowledge_base}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'knowledge_base', checked as boolean, false)}
                            />
                            Knowledge Base
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.agent_settings}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'agent_settings', checked as boolean, false)}
                            />
                            Agent Settings
                          </label>
                          <label className="flex items-center gap-2">
                            <Checkbox
                              checked={perms.specs}
                              onCheckedChange={(checked) => toggleAgentPermission(agent.id, 'specs', checked as boolean, false)}
                            />
                            Specs
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPermissionsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdatePermissions}>Save Changes</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
