import { useState, useEffect } from "react";
import { Shield, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface UserProfileCardProps {
  onSignOut: () => void;
}

export function UserProfileCard({ onSignOut }: UserProfileCardProps) {
  const { user, profile, userType } = useMultiTenantAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [department, setDepartment] = useState<Department | null>(null);
  const [isClientAdmin, setIsClientAdmin] = useState(false);
  const [agencyRole, setAgencyRole] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setEmail(profile.email);
      loadUserDetails();
    }
  }, [profile, user]);

  const loadUserDetails = async () => {
    if (!user) return;

    // Load department for client users
    if (userType === 'client') {
      const { data: clientUser } = await supabase
        .from('client_users')
        .select(`
          department_id,
          departments (
            id,
            name,
            color
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (clientUser?.departments) {
        setDepartment(clientUser.departments as Department);
      }

      // Check if client admin
      const { data: clientUserData } = await supabase
        .from('client_users')
        .select('client_id')
        .eq('user_id', user.id)
        .single();

      if (clientUserData) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('client_id', clientUserData.client_id)
          .eq('role', 'admin')
          .single();

        setIsClientAdmin(!!roleData);
      }
    }

    // Load agency role
    if (userType === 'agency') {
      const { data: agencyUser } = await supabase
        .from('agency_users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (agencyUser) {
        setAgencyRole(agencyUser.role);
      }
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update client_users table if client user
      if (userType === 'client') {
        const { error: clientUserError } = await supabase
          .from('client_users')
          .update({
            first_name: firstName,
            last_name: lastName,
          })
          .eq('user_id', user.id);

        if (clientUserError) throw clientUserError;
      }

      toast.success("Profile updated successfully");
      setPopoverOpen(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || "Failed to update profile");
    }
  };

  const handleChangePassword = async () => {
    if (!user || !oldPassword || !newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: user.id,
          newPassword,
          oldPassword,
          isAdminReset: false,
        },
      });

      if (error) throw error;

      toast.success("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setPopoverOpen(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || "Failed to change password");
    }
  };

  const isSuperAdmin = userType === 'super_admin';
  const isAgencyOwnerOrAdmin = userType === 'agency' && (agencyRole === 'owner' || agencyRole === 'admin');

  return (
    <div className="p-4 border-t border-border">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button className="w-full text-left">
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">
                    {firstName} {lastName}
                  </p>
                  {isSuperAdmin && (
                    <Badge className="bg-blue-500/20 text-blue-700 border-blue-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      Super Admin
                    </Badge>
                  )}
                  {isAgencyOwnerOrAdmin && (
                    <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {agencyRole === 'owner' ? 'Owner' : 'Admin'}
                    </Badge>
                  )}
                </div>
                {department && (
                  <Badge 
                    className="mt-1 text-xs border"
                    style={{ 
                      backgroundColor: `${department.color}15`,
                      color: department.color,
                      borderColor: `${department.color}40`
                    }}
                  >
                    {department.name}
                  </Badge>
                )}
                {isClientAdmin && userType === 'client' && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    Admin
                  </Badge>
                )}
              </div>
              <Settings className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        </PopoverTrigger>
        
        <PopoverContent 
          side="top" 
          align="start" 
          className="w-80 p-0"
        >
          <div className="divide-y">
            {/* Header */}
            <div className="p-4">
              <h3 className="font-semibold text-sm">Profile Settings</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {email}
              </p>
            </div>
            
            {/* Edit Name Section */}
            <div className="p-4 space-y-3">
              <div>
                <Label htmlFor="firstName" className="text-xs">First Name</Label>
                <Input 
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                <Input 
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button 
                size="sm" 
                className="w-full"
                onClick={handleUpdateProfile}
              >
                Save Changes
              </Button>
            </div>
            
            {/* Change Password Section */}
            <div className="p-4 space-y-3">
              <h4 className="font-medium text-xs">Change Password</h4>
              <div>
                <Label htmlFor="oldPassword" className="text-xs">Current Password</Label>
                <Input 
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                <Input 
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button 
                size="sm" 
                variant="secondary"
                className="w-full"
                onClick={handleChangePassword}
              >
                Update Password
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Logout Button */}
      <Button 
        variant="ghost" 
        className="w-full justify-start gap-2 mt-2"
        onClick={onSignOut}
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </Button>
    </div>
  );
}
