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
import { Loader2, Mail, UserPlus, Shield, User, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

      toast.success("User invitation sent successfully");
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
                  <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                    {user.role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
