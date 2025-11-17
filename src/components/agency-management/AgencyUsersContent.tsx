import { useState, useEffect } from "react";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AgencyUserManagementTable, type AgencyUser } from "./AgencyUserManagementTable";

interface AgencyUsersContentProps {
  agencyId: string | undefined;
}

export function AgencyUsersContent({ agencyId }: AgencyUsersContentProps) {
  const { isPreviewMode } = useMultiTenantAuth();
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AgencyUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'user'>('user');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AgencyUser | null>(null);
  
  const [inviteData, setInviteData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    role: "user" as 'owner' | 'admin' | 'user',
  });

  useEffect(() => {
    if (agencyId) {
      loadUsers();
    }
  }, [agencyId]);

  const loadUsers = async () => {
    if (!agencyId) return;
    
    setLoading(true);
    try {
      // Check if we're in preview mode as super admin
      const { data: { user } } = await supabase.auth.getUser();
      let isPreviewSuperAdmin = false;
      
      if (user && isPreviewMode) {
        const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', {
          _user_id: user.id
        });
        isPreviewSuperAdmin = !!isSuperAdmin;
      }

      // If preview super admin, always use the bypass function
      if (isPreviewSuperAdmin) {
        console.log('[AgencyUsersContent] Preview super admin detected, using bypass function');
        
        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'get-agency-users',
          { body: { agencyId } }
        );

        if (functionError) {
          console.error('[AgencyUsersContent] Bypass function error:', functionError);
          toast.error("Failed to load team members in preview mode");
          setLoading(false);
          return;
        }

        if (functionData?.users) {
          setUsers(functionData.users);
          setLoading(false);
          return;
        }
      }

      // Normal path: direct table query
      const { data: agencyUsers, error } = await supabase
        .from('agency_users')
        .select('id, user_id, role, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (agencyUsers && agencyUsers.length > 0) {
        const userIds = agencyUsers.map(u => u.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name, first_name, last_name, updated_at')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        const combinedData: AgencyUser[] = agencyUsers.map(user => ({
          ...user,
          profile: profiles?.find(p => p.id === user.user_id) || { 
            email: '', 
            full_name: null,
            first_name: null,
            last_name: null,
            updated_at: new Date().toISOString()
          }
        }));

        setUsers(combinedData);
      } else {
        setUsers([]);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    
    if (!inviteData.password || inviteData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-agency-user', {
        body: {
          email: inviteData.email,
          firstName: inviteData.firstName,
          lastName: inviteData.lastName,
          password: inviteData.password,
          role: inviteData.role,
          agencyId: agencyId,
        },
      });

      if (error) throw error;

      toast.success("Team member invited successfully");
      setInviteOpen(false);
      setInviteData({ email: "", firstName: "", lastName: "", password: "", role: "user" });
      loadUsers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleEditUser = (user: AgencyUser) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setEditDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !agencyId) return;
    
    const ownerCount = users.filter(u => u.role === 'owner').length;
    if (selectedUser.role === 'owner' && ownerCount === 1 && selectedRole !== 'owner') {
      toast.error("Cannot demote the last owner");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agency_users')
        .update({ role: selectedRole })
        .eq('id', selectedUser.id);
        
      if (error) throw error;
      
      toast.success("Role updated successfully");
      setEditDialogOpen(false);
      setSelectedUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to update role");
    }
  };

  const handleReinvite = async (userId: string) => {
    try {
      await supabase.functions.invoke('reinvite-user', {
        body: {
          userId,
          userType: 'agency',
          contextId: agencyId,
        },
      });

      toast.success("Invitation email sent");
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation");
    }
  };

  const handleRemoveUser = async () => {
    if (!userToDelete || !agencyId) return;
    
    const ownerCount = users.filter(u => u.role === 'owner').length;
    if (userToDelete.role === 'owner' && ownerCount === 1) {
      toast.error("Cannot remove the last owner");
      setDeleteDialogOpen(false);
      return;
    }
    
    try {
      const { error } = await supabase
        .from('agency_users')
        .delete()
        .eq('id', userToDelete.id);
        
      if (error) throw error;
      
      const userName = userToDelete.profile.full_name || 
                       `${userToDelete.profile.first_name} ${userToDelete.profile.last_name}`;
      toast.success(`${userName} has been removed`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to remove user");
    }
  };

  const filteredUsers = users.filter((user) => {
    const searchLower = searchQuery.toLowerCase();
    const fullName = user.profile.full_name || `${user.profile.first_name} ${user.profile.last_name}`;
    return (
      fullName.toLowerCase().includes(searchLower) ||
      user.profile.email.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Team Members</h3>
              <p className="text-sm text-muted-foreground">Manage your agency team members</p>
            </div>
            {!isPreviewMode && (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleInviteUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name *</Label>
                        <Input
                          value={inviteData.firstName}
                          onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name *</Label>
                        <Input
                          value={inviteData.lastName}
                          onChange={(e) => setInviteData({ ...inviteData, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input
                        type="email"
                        value={inviteData.email}
                        onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Password *</Label>
                      <Input
                        type="password"
                        value={inviteData.password}
                        onChange={(e) => setInviteData({ ...inviteData, password: e.target.value })}
                        placeholder="Minimum 6 characters"
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role *</Label>
                      <Select
                        value={inviteData.role}
                        onValueChange={(value: 'owner' | 'admin' | 'user') => 
                          setInviteData({ ...inviteData, role: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviting}>
                        {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Invite User
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <AgencyUserManagementTable
            users={filteredUsers}
            onEdit={handleEditUser}
            onReinvite={handleReinvite}
            onDelete={(user) => {
              setUserToDelete(user);
              setDeleteDialogOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Edit Role Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={selectedRole}
                onValueChange={(value: 'owner' | 'admin' | 'user') => setSelectedRole(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRole}>Update Role</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {userToDelete?.profile.full_name || 
               `${userToDelete?.profile.first_name} ${userToDelete?.profile.last_name}`}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveUser}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}