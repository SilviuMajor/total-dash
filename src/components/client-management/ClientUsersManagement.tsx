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

interface ClientUser {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  page_permissions: {
    dashboard?: boolean;
    analytics?: boolean;
    transcripts?: boolean;
    settings?: boolean;
  };
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

export function ClientUsersManagement({ clientId }: { clientId: string }) {
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<ClientUser | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState("user");
  const [newUserDepartment, setNewUserDepartment] = useState<string>("");
  const [newUserAvatar, setNewUserAvatar] = useState("");
  const [newUserPermissions, setNewUserPermissions] = useState({
    dashboard: true,
    analytics: true,
    transcripts: true,
    settings: false,
  });

  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
    loadDepartments();
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

  const handleAddUser = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          clientId,
          email: newUserEmail,
          fullName: newUserFullName,
          role: newUserRole,
          departmentId: newUserDepartment || null,
          avatarUrl: newUserAvatar || null,
          pagePermissions: newUserPermissions,
        },
      });

      if (error) throw error;

      if (data.success) {
        setGeneratedPassword(data.temporaryPassword);
        toast({
          title: "Success",
          description: `User created successfully. Password: ${data.temporaryPassword}`,
        });
        loadUsers();
        setNewUserEmail("");
        setNewUserFullName("");
        setNewUserRole("user");
        setNewUserDepartment("");
        setNewUserAvatar("");
        setNewUserPermissions({
          dashboard: true,
          analytics: true,
          transcripts: true,
          settings: false,
        });
      }
    } catch (error: any) {
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
      const { error } = await supabase
        .from('client_users')
        .update({
          page_permissions: selectedUser.page_permissions,
          full_name: selectedUser.full_name,
          role: selectedUser.role,
          department_id: selectedUser.department_id,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

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
                    <Badge variant="outline">{user.role}</Badge>
                    {user.departments && (
                      <Badge variant="secondary">{user.departments.name}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.profiles.email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedUser(user);
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
        <DialogContent className="max-w-md">
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
                  <SelectItem value="">No Department</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
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
            <div>
              <Label htmlFor="avatar">Avatar URL (optional)</Label>
              <Input
                id="avatar"
                value={newUserAvatar}
                onChange={(e) => setNewUserAvatar(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>Page Permissions</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dashboard"
                    checked={newUserPermissions.dashboard}
                    onCheckedChange={(checked) =>
                      setNewUserPermissions({ ...newUserPermissions, dashboard: checked as boolean })
                    }
                  />
                  <Label htmlFor="dashboard" className="font-normal">Dashboard</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics"
                    checked={newUserPermissions.analytics}
                    onCheckedChange={(checked) =>
                      setNewUserPermissions({ ...newUserPermissions, analytics: checked as boolean })
                    }
                  />
                  <Label htmlFor="analytics" className="font-normal">Analytics</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="transcripts"
                    checked={newUserPermissions.transcripts}
                    onCheckedChange={(checked) =>
                      setNewUserPermissions({ ...newUserPermissions, transcripts: checked as boolean })
                    }
                  />
                  <Label htmlFor="transcripts" className="font-normal">Call Transcripts</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="settings"
                    checked={newUserPermissions.settings}
                    onCheckedChange={(checked) =>
                      setNewUserPermissions({ ...newUserPermissions, settings: checked as boolean })
                    }
                  />
                  <Label htmlFor="settings" className="font-normal">Settings</Label>
                </div>
              </div>
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
              <Button onClick={handleAddUser} className="flex-1 bg-foreground text-background hover:bg-foreground/90">
                Create User
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <DialogContent className="max-w-md">
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
                  value={selectedUser.department_id || ""}
                  onValueChange={(value) =>
                    setSelectedUser({ ...selectedUser, department_id: value || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Department</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="editRole">Role</Label>
                <Select
                  value={selectedUser.role}
                  onValueChange={(value) =>
                    setSelectedUser({ ...selectedUser, role: value })
                  }
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

              <div className="space-y-2">
                <Label>Page Access</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-dashboard"
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
                    <Label htmlFor="edit-dashboard" className="font-normal">Dashboard</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-analytics"
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
                    <Label htmlFor="edit-analytics" className="font-normal">Analytics</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-transcripts"
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
                    <Label htmlFor="edit-transcripts" className="font-normal">Call Transcripts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-settings"
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
                    <Label htmlFor="edit-settings" className="font-normal">Settings</Label>
                  </div>
                </div>
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
