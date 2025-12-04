import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, Trash2, UserPlus, Eye, EyeOff, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AvatarUpload } from "@/components/AvatarUpload";
import { PasswordDisplay } from "@/components/PasswordDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface ClientUser {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  roles: string[];
  department_id: string | null;
  page_permissions: {
    dashboard: boolean;
    analytics: boolean;
    transcripts: boolean;
    settings: boolean;
    guides: boolean;
  };
  profiles: {
    email: string;
  };
  departments: {
    name: string;
  } | null;
  password?: string;
}

interface Department {
  id: string;
  name: string;
}

export function TeamMembersCard({ clientId }: { clientId: string }) {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<ClientUser | null>(null);
  const [defaultPermissions, setDefaultPermissions] = useState({
    dashboard: true,
    analytics: true,
    transcripts: true,
    settings: false,
    guides: false,
  });
  const { toast } = useToast();
  const { profile } = useAuth();

  const [newUser, setNewUser] = useState({
    email: "",
    firstName: "",
    lastName: "",
    role: "user",
    department_id: "none",
    avatar_url: "",
    password: "",
  });

  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");

  useEffect(() => {
    loadData();
  }, [clientId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load departments
      const { data: deptData } = await supabase.rpc('get_user_departments', {
        _client_id: clientId
      });
      setDepartments(deptData || []);

      // Load users
      const { data: userData, error: userError } = await supabase
        .from('client_users')
        .select(`
          *,
          profiles!client_users_user_id_fkey(email),
          departments(name)
        `)
        .eq('client_id', clientId);

      if (userError) throw userError;
      
      // Fetch roles for each user
      const usersWithRoles = await Promise.all(
        (userData || []).map(async (user) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.user_id)
            .eq('client_id', clientId);
          
          return {
            ...user,
            roles: roleData?.map(r => r.role) || [],
            page_permissions: user.page_permissions as {
              dashboard: boolean;
              analytics: boolean;
              transcripts: boolean;
              settings: boolean;
              guides: boolean;
            }
          };
        })
      );
      
      setUsers(usersWithRoles);

      // Load default permissions
      const { data: settingsData } = await supabase
        .from('client_settings')
        .select('default_user_permissions')
        .eq('client_id', clientId)
        .single();

      if (settingsData?.default_user_permissions) {
        setDefaultPermissions(settingsData.default_user_permissions as any);
      }
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

  const handleAddUser = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          clientId,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
          departmentId: newUser.department_id === "none" ? null : newUser.department_id || null,
          avatarUrl: newUser.avatar_url || null,
          pagePermissions: defaultPermissions,
          customPassword: newUser.password || undefined,
        },
      });

      if (error) throw error;

      setTempPassword(data.temporaryPassword);
      toast({
        title: "Success",
        description: "User created successfully",
      });

      setNewUser({
        email: "",
        firstName: "",
        lastName: "",
        role: "user",
        department_id: "none",
        avatar_url: "",
        password: "",
      });

      loadData();
    } catch (error: any) {
      setAddDialogOpen(false);
      setTempPassword(null);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPasswordValue.trim()) {
      toast({
        title: "Error",
        description: "Password cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId,
          newPassword: newPasswordValue,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password updated successfully",
      });

      setEditingPasswordId(null);
      setNewPasswordValue("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getCensoredPassword = (password: string | undefined) => {
    if (!password) return "••••••••";
    return password.charAt(0) + "••••••••";
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const { error } = await supabase
        .from('client_users')
        .update({
          full_name: selectedUser.full_name,
          department_id: selectedUser.department_id,
          page_permissions: selectedUser.page_permissions,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

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

      toast({
        title: "Success",
        description: "User permissions updated",
      });

      setEditDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { error } = await supabase
        .from('client_users')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from client",
      });

      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card className="p-6 bg-gradient-card border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
          <p className="text-sm text-muted-foreground">Manage users who can access your dashboard</p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-foreground text-background hover:bg-foreground/90 gap-2">
              <UserPlus className="w-4 h-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Create a new user account for your team member
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={newUser.department_id}
                    onValueChange={(value) => setNewUser({ ...newUser, department_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.filter(dept => dept.id && dept.id.trim() !== '').map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newUser.role}
                    onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <AvatarUpload
                currentUrl={newUser.avatar_url}
                onUploadComplete={(url) => setNewUser({ ...newUser, avatar_url: url })}
              />

              <div className="space-y-2">
                <Label htmlFor="password">Password (optional)</Label>
                <Input
                  id="password"
                  type="text"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Leave empty to auto-generate"
                />
                <p className="text-xs text-muted-foreground">
                  If left empty, a secure password will be generated automatically. Minimum 6 characters (Supabase requirement).
                </p>
              </div>

              {tempPassword && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <Label>Temporary Password</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded text-sm">
                      {tempPassword}
                    </code>
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(tempPassword);
                        toast({ description: "Password copied to clipboard" });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this password with the user. They can use it to log in.
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false);
                    setTempPassword(null);
                  }}
                >
                  {tempPassword ? "Done" : "Cancel"}
                </Button>
                {!tempPassword && (
                  <Button
                    onClick={handleAddUser}
                    disabled={!newUser.email || !newUser.firstName || !newUser.lastName}
                    className="bg-foreground text-background hover:bg-foreground/90"
                  >
                    Create User
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground text-sm">No team members yet</p>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{user.full_name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{user.profiles.email}</p>
                </div>
                {user.departments && (
                  <Badge variant="outline">{user.departments.name}</Badge>
                )}
                {user.roles.includes('admin') && (
                  <Badge variant="default">Admin</Badge>
                )}
                {user.roles.includes('user') && !user.roles.includes('admin') && (
                  <Badge variant="secondary">User</Badge>
                )}
                <PasswordDisplay userId={user.user_id} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setSelectedUser(user);
                    setEditDialogOpen(true);
                  }}
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setUserToDelete(user);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Permissions Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Permissions</DialogTitle>
            <DialogDescription>
              Manage page access and user details for {selectedUser?.full_name}
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedUser.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(selectedUser.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.profiles.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Page Access</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedUser.page_permissions.dashboard}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          page_permissions: {
                            ...selectedUser.page_permissions,
                            dashboard: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label className="font-normal">Dashboard</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedUser.page_permissions.analytics}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          page_permissions: {
                            ...selectedUser.page_permissions,
                            analytics: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label className="font-normal">Analytics</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedUser.page_permissions.transcripts}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          page_permissions: {
                            ...selectedUser.page_permissions,
                            transcripts: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label className="font-normal">Transcripts</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedUser.page_permissions.settings}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          page_permissions: {
                            ...selectedUser.page_permissions,
                            settings: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label className="font-normal">Settings</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedUser.page_permissions.guides}
                      onCheckedChange={(checked) =>
                        setSelectedUser({
                          ...selectedUser,
                          page_permissions: {
                            ...selectedUser.page_permissions,
                            guides: checked as boolean,
                          },
                        })
                      }
                    />
                    <Label className="font-normal">Guides</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={selectedUser.full_name || ""}
                  onChange={(e) =>
                    setSelectedUser({ ...selectedUser, full_name: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
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
                    <SelectItem value="none">None</SelectItem>
                    {departments.filter(dept => dept.id && dept.id.trim() !== '').map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={selectedUser.roles.includes('admin') ? 'admin' : 'user'}
                  onValueChange={(value) =>
                    setSelectedUser({ ...selectedUser, roles: value === 'admin' ? ['admin'] : ['user'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleUpdateUser}
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToDelete?.full_name} from this client? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
