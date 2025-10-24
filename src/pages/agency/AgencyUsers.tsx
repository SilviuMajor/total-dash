import { useState, useEffect } from "react";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, UserPlus, Shield, User, Crown, CheckCircle, Copy, Trash2, Edit2, X, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface AgencyUser {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'user';
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

export default function AgencyUsers() {
  const { profile, isPreviewMode, previewAgency } = useMultiTenantAuth();
  const agencyId = isPreviewMode ? previewAgency?.id : profile?.agency?.id;
  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: "",
    fullName: "",
    role: "user" as 'owner' | 'admin' | 'user',
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [invitedUserData, setInvitedUserData] = useState<{
    email: string;
    fullName: string;
    tempPassword: string;
  } | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'user'>('user');
  const [updatingRole, setUpdatingRole] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AgencyUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (agencyId) {
      loadUsers();
    }
  }, [agencyId]);

  const loadUsers = async () => {
    if (!agencyId) return;
    
    setLoading(true);
    try {
      const { data: agencyUsers, error } = await supabase
        .from('agency_users')
        .select('id, user_id, role, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      if (agencyUsers && agencyUsers.length > 0) {
        const userIds = agencyUsers.map(u => u.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        if (profilesError) throw profilesError;

        // Combine data
        const combinedData = agencyUsers.map(user => ({
          ...user,
          profiles: profiles?.find(p => p.id === user.user_id) || { email: '', full_name: null }
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

  const handleInviteUser = async () => {
    if (!agencyId) return;
    
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-agency-user', {
        body: {
          email: inviteData.email,
          fullName: inviteData.fullName,
          role: inviteData.role,
          agencyId: agencyId,
        },
      });

      if (error) throw error;

      // Show password dialog with temp password
      setInvitedUserData({
        email: inviteData.email,
        fullName: inviteData.fullName,
        tempPassword: data.tempPassword,
      });
      setPasswordDialogOpen(true);
      setInviteOpen(false);
      setInviteData({ email: "", fullName: "", role: "user" });
      loadUsers();
    } catch (error: any) {
      console.error('Error inviting user:', error);
      toast.error(error.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'admin' | 'user') => {
    if (!agencyId) return;
    
    // Check if trying to demote last owner
    const ownerCount = users.filter(u => u.role === 'owner').length;
    const currentUser = users.find(u => u.id === userId);
    
    if (currentUser?.role === 'owner' && ownerCount === 1 && newRole !== 'owner') {
      toast.error("Cannot demote the last owner");
      return;
    }
    
    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from('agency_users')
        .update({ role: newRole })
        .eq('id', userId);
        
      if (error) throw error;
      
      toast.success("Role updated successfully");
      setEditingUserId(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to update role");
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!userToDelete || !agencyId) return;
    
    // Check if trying to remove last owner
    const ownerCount = users.filter(u => u.role === 'owner').length;
    if (userToDelete.role === 'owner' && ownerCount === 1) {
      toast.error("Cannot remove the last owner");
      setDeleteDialogOpen(false);
      return;
    }
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('agency_users')
        .delete()
        .eq('id', userToDelete.id);
        
      if (error) throw error;
      
      toast.success(`${userToDelete.profiles.full_name} has been removed`);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to remove user");
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" => {
    switch (role) {
      case 'owner':
        return "default";
      case 'admin':
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team Members</h1>
          <p className="text-muted-foreground">Manage your agency team members</p>
        </div>
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
              <DialogDescription>
                Send an invitation to add a new team member to your agency
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={inviteData.fullName}
                  onChange={(e) => setInviteData({ ...inviteData, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
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
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleInviteUser}
                disabled={inviting || !inviteData.email || !inviteData.fullName}
              >
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Invitation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No team members yet</p>
            <p className="text-muted-foreground text-center mb-4">
              Invite team members to collaborate on your agency
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      {getRoleIcon(user.role)}
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        {user.profiles?.full_name || "Unnamed User"}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <Mail className="h-3 w-3" />
                        {user.profiles?.email}
                      </CardDescription>
                    </div>
                  </div>
                  {editingUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedRole}
                        onValueChange={(value: 'owner' | 'admin' | 'user') => setSelectedRole(value)}
                        disabled={updatingRole}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        size="sm" 
                        onClick={() => handleUpdateRole(user.id, selectedRole)}
                        disabled={updatingRole}
                      >
                        {updatingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setEditingUserId(null)}
                        disabled={updatingRole}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                        {user.role}
                      </Badge>
                      {(users.find(u => u.user_id === profile?.id)?.role === 'owner' || isPreviewMode) && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => {
                            setEditingUserId(user.id);
                            setSelectedRole(user.role);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                  {(users.find(u => u.user_id === profile?.id)?.role === 'owner' || isPreviewMode) && user.user_id !== profile?.id && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setUserToDelete(user);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Password Display Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <DialogTitle>User Invited Successfully</DialogTitle>
            </div>
            <DialogDescription>
              {invitedUserData?.fullName} has been invited to join your agency
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2">
                <Input value={invitedUserData?.email || ''} readOnly />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(invitedUserData?.email || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2">
                <Input value={invitedUserData?.tempPassword || ''} readOnly type="text" className="font-mono" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(invitedUserData?.tempPassword || '')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Save this password - it won't be shown again
              </p>
            </div>
            <div className="space-y-2">
              <Label>Login URL</Label>
              <div className="flex items-center gap-2">
                <Input value={`${window.location.origin}/agency/login`} readOnly />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(`${window.location.origin}/agency/login`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setInviteOpen(true);
              }}
            >
              Invite Another
            </Button>
            <Button onClick={() => setPasswordDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToDelete?.profiles.full_name}? 
              They will lose access to the agency immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
