import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Settings, Trash2, UserPlus, Copy } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PasswordDisplay } from "@/components/PasswordDisplay";

interface ClientUser {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
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
  knowledge_base: boolean;
  agent_settings: boolean;
  specs: boolean;
}

export function ClientUsersManagement({ clientId }: { clientId: string }) {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<ClientUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserDepartment, setNewUserDepartment] = useState<string>("none");
  const [newUserAvatar, setNewUserAvatar] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAgentPermissions, setNewUserAgentPermissions] = useState<Record<string, AgentPermission>>({});
  const [selectedUserAgentPermissions, setSelectedUserAgentPermissions] = useState<Record<string, AgentPermission>>({});

  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadDepartments();
    loadAgents();
  }, [clientId]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('client_users')
        .select(`
          *,
          profiles!inner(email),
          departments(name)
        `)
        .eq('client_id', clientId);

      if (error) throw error;
      setUsers((data || []) as ClientUser[]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
      console.error('Error loading departments:', error);
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

      if (error) throw error;
      
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
          knowledge_base: false,
          agent_settings: false,
          specs: true,
        };
      });
      setNewUserAgentPermissions(initialPermissions);
    } catch (error: any) {
      console.error('Error loading agents:', error);
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
      // Only include agents where user has access
      const activePermissions = Object.values(newUserAgentPermissions);
      
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          clientId,
          email: newUserEmail,
          fullName: newUserFullName,
          departmentId: newUserDepartment === "none" ? null : newUserDepartment || null,
          avatarUrl: newUserAvatar || null,
          agentPermissions: activePermissions,
          customPassword: newUserPassword || undefined,
        },
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedPassword(data.temporaryPassword);
        toast({
          title: "Success",
          description: `User created successfully`,
        });
        loadUsers();
        setNewUserEmail("");
        setNewUserFullName("");
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
            knowledge_base: false,
            agent_settings: false,
            specs: true,
          };
        });
        setNewUserAgentPermissions(initialPermissions);
      }
    } catch (error: any) {
      setOpen(false);
      setGeneratedPassword("");
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedUser) return;

    try {
      // Update client_users basic info
      const { error: userError } = await supabase
        .from('client_users')
        .update({
          full_name: selectedUser.full_name,
          department_id: selectedUser.department_id,
        })
        .eq('id', selectedUser.id);

      if (userError) throw userError;

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

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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

  return (
    <>
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
                    {user.departments && (
                      <Badge variant="secondary">{user.departments.name}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.profiles.email}</p>
                  <PasswordDisplay userId={user.user_id} />
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
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Department</SelectItem>
                  {departments.filter(dept => dept.id && dept.id.trim() !== '').map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="avatar">Avatar</Label>
              <AvatarUpload
                currentUrl={newUserAvatar}
                onUploadComplete={(url) => setNewUserAvatar(url)}
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
              <p className="text-xs text-muted-foreground mt-1">
                If left empty, a secure password will be generated automatically. Minimum 6 characters (Supabase requirement).
              </p>
            </div>
            
            {/* Agent Permissions */}
            <div className="space-y-3">
              <Label>Agent Permissions</Label>
              {agents.map((agent) => (
                <div key={agent.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{agent.name}</p>
                    <Badge variant="outline">{agent.provider}</Badge>
                  </div>
                  
                  <div className="ml-0 space-y-2 grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${agent.id}-analytics`}
                        checked={newUserAgentPermissions[agent.id]?.analytics || false}
                        onCheckedChange={(checked) => 
                          toggleAgentPermission(agent.id, 'analytics', checked as boolean, true)
                        }
                      />
                      <Label htmlFor={`new-${agent.id}-analytics`} className="font-normal">Analytics</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${agent.id}-conversations`}
                        checked={newUserAgentPermissions[agent.id]?.conversations || false}
                        onCheckedChange={(checked) => 
                          toggleAgentPermission(agent.id, 'conversations', checked as boolean, true)
                        }
                      />
                      <Label htmlFor={`new-${agent.id}-conversations`} className="font-normal">Conversations</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${agent.id}-specs`}
                        checked={newUserAgentPermissions[agent.id]?.specs || false}
                        onCheckedChange={(checked) => 
                          toggleAgentPermission(agent.id, 'specs', checked as boolean, true)
                        }
                      />
                      <Label htmlFor={`new-${agent.id}-specs`} className="font-normal">Specifications</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${agent.id}-knowledge_base`}
                        checked={newUserAgentPermissions[agent.id]?.knowledge_base || false}
                        onCheckedChange={(checked) => 
                          toggleAgentPermission(agent.id, 'knowledge_base', checked as boolean, true)
                        }
                      />
                      <Label htmlFor={`new-${agent.id}-knowledge_base`} className="font-normal">Knowledge Base</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`new-${agent.id}-agent_settings`}
                        checked={newUserAgentPermissions[agent.id]?.agent_settings || false}
                        onCheckedChange={(checked) => 
                          toggleAgentPermission(agent.id, 'agent_settings', checked as boolean, true)
                        }
                      />
                      <Label htmlFor={`new-${agent.id}-agent_settings`} className="font-normal">Agent Settings</Label>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {generatedPassword && (
              <div className="p-4 bg-muted rounded-lg">
                <Label>Temporary Password</Label>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded border text-sm">
                    {generatedPassword}
                  </code>
                  <Button variant="outline" size="icon" onClick={copyPassword}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              {!generatedPassword ? (
                <>
                  <Button onClick={handleAddUser} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                    Create User
                  </Button>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setOpen(false);
                    setGeneratedPassword("");
                  }}
                  className="flex-1"
                >
                  Done
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
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Avatar>
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(selectedUser.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.profiles.email}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="editFullName">Full Name</Label>
                <Input
                  id="editFullName"
                  value={selectedUser.full_name || ""}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, full_name: e.target.value })
                  }
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
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {departments.filter(dept => dept.id && dept.id.trim() !== '').map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Agent Permissions */}
              <div className="space-y-3">
                <Label>Agent Permissions</Label>
                {agents.map((agent) => (
                  <div key={agent.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{agent.name}</p>
                      <Badge variant="outline">{agent.provider}</Badge>
                    </div>
                    
                    <div className="ml-0 space-y-2 grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${agent.id}-analytics`}
                          checked={selectedUserAgentPermissions[agent.id]?.analytics || false}
                          onCheckedChange={(checked) => 
                            toggleAgentPermission(agent.id, 'analytics', checked as boolean, false)
                          }
                        />
                        <Label htmlFor={`edit-${agent.id}-analytics`} className="font-normal">Analytics</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${agent.id}-conversations`}
                          checked={selectedUserAgentPermissions[agent.id]?.conversations || false}
                          onCheckedChange={(checked) => 
                            toggleAgentPermission(agent.id, 'conversations', checked as boolean, false)
                          }
                        />
                        <Label htmlFor={`edit-${agent.id}-conversations`} className="font-normal">Conversations</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${agent.id}-specs`}
                          checked={selectedUserAgentPermissions[agent.id]?.specs || false}
                          onCheckedChange={(checked) => 
                            toggleAgentPermission(agent.id, 'specs', checked as boolean, false)
                          }
                        />
                        <Label htmlFor={`edit-${agent.id}-specs`} className="font-normal">Specifications</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${agent.id}-knowledge_base`}
                          checked={selectedUserAgentPermissions[agent.id]?.knowledge_base || false}
                          onCheckedChange={(checked) => 
                            toggleAgentPermission(agent.id, 'knowledge_base', checked as boolean, false)
                          }
                        />
                        <Label htmlFor={`edit-${agent.id}-knowledge_base`} className="font-normal">Knowledge Base</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-${agent.id}-agent_settings`}
                          checked={selectedUserAgentPermissions[agent.id]?.agent_settings || false}
                          onCheckedChange={(checked) => 
                            toggleAgentPermission(agent.id, 'agent_settings', checked as boolean, false)
                          }
                        />
                        <Label htmlFor={`edit-${agent.id}-agent_settings`} className="font-normal">Agent Settings</Label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button onClick={handleUpdatePermissions} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setPermissionsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.full_name} from this client? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveUser} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
