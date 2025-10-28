import { useState, useEffect } from "react";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronLeft, User, Mail, Lock, Bell } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface UserProfileCardProps {
  onSignOut: () => void;
}

type MenuView = 'main' | 'account' | 'edit-name' | 'change-email' | 'change-password';

export function UserProfileCard({ onSignOut }: UserProfileCardProps) {
  const { profile, userType } = useMultiTenantAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  
  // Password fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Department and role info
  const [department, setDepartment] = useState<Department | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [profileAccessControl, setProfileAccessControl] = useState<any>(null);
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setEmail(profile.email || "");
      setNewEmail(profile.email || "");
      loadUserDetails();
    }
  }, [profile]);

  const loadUserDetails = async () => {
    if (!profile?.id) return;

    try {
      // Load department (for client users)
      if (userType === 'client') {
        const { data: clientUserData } = await supabase
          .from('client_users')
          .select('client_id, department_id, departments(id, name, color)')
          .eq('user_id', profile.id)
          .single();

        if (clientUserData?.departments) {
          setDepartment(clientUserData.departments as Department);
        }
        
        if (clientUserData?.client_id) {
          setClientId(clientUserData.client_id);
          
          // Load profile access control settings
          const { data: settingsData } = await supabase
            .from('client_settings')
            .select('profile_access_control')
            .eq('client_id', clientUserData.client_id)
            .single();
          
          if (settingsData?.profile_access_control) {
            setProfileAccessControl(settingsData.profile_access_control);
          }
        }

        // Load roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', profile.id);

        if (rolesData) {
          setRoles(rolesData.map(r => r.role));
        }
      } else if (userType === 'agency') {
        const { data: agencyUserData } = await supabase
          .from('agency_users')
          .select('role')
          .eq('user_id', profile.id)
          .single();

        if (agencyUserData?.role) {
          setRoles([agencyUserData.role]);
        }
      }
    } catch (error: any) {
      console.error("Error loading user details:", error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!profile?.id) return;

    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Update client_users table if client user
      if (userType === 'client') {
        const { error: clientUserError } = await supabase
          .from('client_users')
          .update({
            first_name: firstName,
            last_name: lastName,
          })
          .eq('user_id', profile.id);

        if (clientUserError) throw clientUserError;
      }

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      setMenuView('main');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangeEmail = async () => {
    try {
      if (newEmail === email) {
        toast({
          title: "No Changes",
          description: "Please enter a different email address.",
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) throw error;

      toast({
        title: "Verification Email Sent",
        description: "Please check your new email address to confirm the change.",
      });
      setMenuView('main');
      setNewEmail("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    try {
      if (newPassword !== confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.functions.invoke('reset-user-password', {
        body: {
          userId: profile?.id,
          oldPassword,
          newPassword,
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Password changed successfully",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMenuView('main');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Check access permissions
  const isAdmin = roles.includes('admin');
  const isSuperAdmin = userType === 'super_admin';
  const isAgencyUser = userType === 'agency';
  
  const canEditName = isSuperAdmin || isAgencyUser || !profileAccessControl || profileAccessControl.edit_name === 'all' || isAdmin;
  const canChangeEmail = isSuperAdmin || isAgencyUser || !profileAccessControl || profileAccessControl.change_email === 'all' || isAdmin;
  const canChangePassword = isSuperAdmin || isAgencyUser || !profileAccessControl || profileAccessControl.change_password === 'all' || isAdmin;

  const resetToMain = () => {
    setMenuView('main');
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNewEmail(email);
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetToMain();
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-3 w-full justify-start hover:bg-accent/50 px-4 py-3 h-auto min-h-[72px]">
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate max-w-full">
              {firstName && lastName ? `${firstName} ${lastName}` : profile?.email}
            </span>
            <div className="flex gap-1 flex-wrap">
              {userType === 'super_admin' && (
                <Badge className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">Super Admin</Badge>
              )}
              {userType === 'agency' && roles.includes('owner') && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">Agency Owner</Badge>
              )}
              {userType === 'agency' && roles.includes('admin') && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">Agency Admin</Badge>
              )}
              {userType === 'client' && isAdmin && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">Client Admin</Badge>
              )}
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        {/* Main Menu */}
        {menuView === 'main' && (
          <div className="space-y-1 p-2">
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium text-foreground">
                {firstName && lastName ? `${firstName} ${lastName}` : 'User Profile'}
              </p>
              <p className="text-xs text-muted-foreground">{email}</p>
              {department && (
                <Badge 
                  className="mt-2 text-xs"
                  style={{ backgroundColor: department.color }}
                >
                  {department.name}
                </Badge>
              )}
            </div>
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2"
              onClick={() => setMenuView('account')}
            >
              <User className="h-4 w-4" />
              <span>Account Details</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2"
              disabled
            >
              <Bell className="h-4 w-4" />
              <span className="flex-1 text-left">Notifications</span>
              <Badge variant="outline" className="text-xs">Coming Soon</Badge>
            </Button>
            <Separator />
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-auto py-2"
              onClick={onSignOut}
            >
              Sign Out
            </Button>
          </div>
        )}

        {/* Account Details Submenu */}
        {menuView === 'account' && (
          <div className="space-y-1 p-2">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2 mb-2"
              onClick={() => setMenuView('main')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <Separator />
            {canEditName && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-2"
                onClick={() => setMenuView('edit-name')}
              >
                <User className="h-4 w-4" />
                <span>Edit Name</span>
              </Button>
            )}
            {canChangeEmail && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-2"
                onClick={() => setMenuView('change-email')}
              >
                <Mail className="h-4 w-4" />
                <span>Change Email</span>
              </Button>
            )}
            {canChangePassword && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-2"
                onClick={() => setMenuView('change-password')}
              >
                <Lock className="h-4 w-4" />
                <span>Change Password</span>
              </Button>
            )}
          </div>
        )}

        {/* Edit Name View */}
        {menuView === 'edit-name' && (
          <div className="p-4 space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2 -mt-2 mb-2"
              onClick={() => setMenuView('account')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
              />
            </div>
            <Button onClick={handleUpdateProfile} className="w-full">
              Save Changes
            </Button>
          </div>
        )}

        {/* Change Email View */}
        {menuView === 'change-email' && (
          <div className="p-4 space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2 -mt-2 mb-2"
              onClick={() => setMenuView('account')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email</Label>
              <Input
                id="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Enter new email"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A verification link will be sent to your new email address.
            </p>
            <Button onClick={handleChangeEmail} className="w-full">
              Send Verification Email
            </Button>
          </div>
        )}

        {/* Change Password View */}
        {menuView === 'change-password' && (
          <div className="p-4 space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2 -mt-2 mb-2"
              onClick={() => setMenuView('account')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div className="space-y-2">
              <Label htmlFor="oldPassword">Current Password</Label>
              <Input
                id="oldPassword"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button onClick={handleChangePassword} className="w-full">
              Change Password
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}