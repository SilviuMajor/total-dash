import { useState, useEffect } from "react";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, ChevronLeft, User, Mail, Lock, Volume2, Sun, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { getSoundPreferences, saveSoundPreferences, playTestSound, SoundPreferences, HANDOVER_SOUNDS, MESSAGE_SOUNDS, requestNotificationPermission } from "@/lib/notificationSounds";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { UserAvatar, AVATAR_COLORS, type AvatarColor } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";
import { deptChipClasses } from "@/lib/deptColor";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface UserProfileCardProps {
  onSignOut: () => void;
}

type MenuView = 'main' | 'account' | 'edit-name' | 'change-email' | 'change-password' | 'notifications';

export function UserProfileCard({ onSignOut }: UserProfileCardProps) {
  const { profile, userType, isClientPreviewMode, previewDepth } = useMultiTenantAuth();
  const { effectiveTheme, setTheme, isLoading: themeLoading } = useTheme();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [soundPrefs, setSoundPrefs] = useState<SoundPreferences>(getSoundPreferences());

  const updateSoundPref = (key: keyof SoundPreferences, value: any) => {
    const updated = { ...soundPrefs, [key]: value };
    setSoundPrefs(updated);
    saveSoundPreferences(updated);
  };
  
  // Profile fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [themeColor, setThemeColor] = useState<AvatarColor | null>(null);
  
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
      setThemeColor(((profile as any).theme_color as AvatarColor | null) || null);
      loadUserDetails();
    }
  }, [profile]);

  const handleSelectAvatarColor = async (color: AvatarColor) => {
    if (!profile?.id) return;
    const next = themeColor === color ? null : color;
    setThemeColor(next);
    document.documentElement.setAttribute('data-theme-color', next || 'sky');
    const { error } = await supabase
      .from('profiles')
      .update({ theme_color: next })
      .eq('id', profile.id);
    if (error) {
      toast({ title: 'Could not save theme colour', description: error.message, variant: 'destructive' });
      setThemeColor(themeColor);
      document.documentElement.setAttribute('data-theme-color', themeColor || 'sky');
    }
  };

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

        // Load roles from new permission system
        const { data: permData } = await supabase
          .from('client_user_agent_permissions')
          .select('role_id, client_roles:client_roles(name)')
          .eq('user_id', profile.id)
          .limit(1)
          .maybeSingle();

        if (permData?.client_roles) {
          setRoles([(permData.client_roles as any).name]);
        } else {
          // Fallback to legacy user_roles
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id);
          if (rolesData) {
            setRoles(rolesData.map(r => r.role));
          }
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
  const isOperatingAsClient = userType === 'client' || isClientPreviewMode || previewDepth === 'agency_to_client';
  
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
        <Button variant="ghost" className="flex items-center gap-3 w-full justify-start hover:bg-accent/50 px-3.5 py-3 h-auto min-h-[72px]">
          <UserAvatar
            firstName={profile?.first_name}
            lastName={profile?.last_name}
            color={themeColor}
            size="md"
          />
          <div className="flex flex-col items-start flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate max-w-full">
              {profile?.full_name || profile?.first_name || profile?.email}
            </span>
            <div className="flex gap-1 flex-wrap">
              {department && (() => {
                const chip = deptChipClasses(department.color);
                return (
                  <Badge className={cn("text-xs px-1.5 py-0 border", chip.className)} style={chip.style}>
                    {department.name}
                  </Badge>
                );
              })()}
              {roles.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">{roles[0]}</Badge>
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
            <div className="px-3 py-2 mb-2 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {firstName && lastName ? `${firstName} ${lastName}` : 'User Profile'}
                </p>
                <p className="text-xs text-muted-foreground">{email}</p>
                {department && (() => {
                  const chip = deptChipClasses(department.color);
                  return (
                  <Badge
                    className={cn("mt-2 text-xs border", chip.className)}
                    style={chip.style}
                  >
                    {department.name}
                  </Badge>
                  );
                })()}
              </div>
              
              {/* Theme toggle button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0 ml-2"
                onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
                disabled={themeLoading}
              >
                {effectiveTheme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
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
            {isOperatingAsClient && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 h-auto py-2"
                onClick={() => setMenuView('notifications')}
              >
                <Volume2 className="h-4 w-4" />
                <span>Notifications</span>
              </Button>
            )}
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
            <div className="px-3 py-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Theme colour</Label>
              <div className="flex items-center gap-2">
                {AVATAR_COLORS.map(({ value, label }) => {
                  const isSelected = themeColor === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelectAvatarColor(value)}
                      title={label}
                      aria-label={label}
                      aria-pressed={isSelected}
                      className={cn(
                        'rounded-md transition-all',
                        isSelected ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground' : 'hover:scale-110',
                      )}
                    >
                      <UserAvatar
                        firstName={firstName}
                        lastName={lastName}
                        color={value}
                        size="sm"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
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

        {/* Notifications View */}
        {menuView === 'notifications' && (
          <div className="p-4 space-y-4">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 h-auto py-2 -mt-2 mb-2"
              onClick={() => setMenuView('main')}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <p className="text-sm font-medium">Notification Sounds</p>

            {/* Handover request sound */}
            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm">Handover requests</span>
                <Switch
                  checked={soundPrefs.handoverRequestEnabled}
                  onCheckedChange={(v) => updateSoundPref('handoverRequestEnabled', v)}
                />
              </div>
              {soundPrefs.handoverRequestEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={soundPrefs.handoverRequestSound}
                      onValueChange={(v) => {
                        updateSoundPref('handoverRequestSound', v);
                        playTestSound("handover", soundPrefs.handoverRequestVolume, v);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HANDOVER_SOUNDS.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => playTestSound("handover", soundPrefs.handoverRequestVolume)}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Test
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Slider
                      value={[soundPrefs.handoverRequestVolume * 100]}
                      onValueChange={(v) => updateSoundPref('handoverRequestVolume', v[0] / 100)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t mt-1">
                    <span className="text-xs">My departments only</span>
                    <Switch
                      checked={soundPrefs.myDepartmentsOnly || false}
                      onCheckedChange={(v) => updateSoundPref('myDepartmentsOnly', v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* New message sound */}
            <div className="space-y-2 p-3 border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm">Customer messages</span>
                <Switch
                  checked={soundPrefs.newMessageEnabled}
                  onCheckedChange={(v) => updateSoundPref('newMessageEnabled', v)}
                />
              </div>
              {soundPrefs.newMessageEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={soundPrefs.newMessageSound}
                      onValueChange={(v) => {
                        updateSoundPref('newMessageSound', v);
                        playTestSound("message", soundPrefs.newMessageVolume, v);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MESSAGE_SOUNDS.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => playTestSound("message", soundPrefs.newMessageVolume)}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      Test
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <Slider
                      value={[soundPrefs.newMessageVolume * 100]}
                      onValueChange={(v) => updateSoundPref('newMessageVolume', v[0] / 100)}
                      max={100}
                      step={5}
                      className="flex-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Browser notifications */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <span className="text-sm">Browser notifications</span>
                <p className="text-xs text-muted-foreground">Show alerts when tab is not focused</p>
              </div>
              <Switch
                checked={soundPrefs.browserNotifications}
                onCheckedChange={async (v) => {
                  if (v) {
                    const granted = await requestNotificationPermission();
                    if (!granted) {
                      toast({ title: "Permission denied", description: "Please allow notifications in your browser settings", variant: "destructive" });
                      return;
                    }
                  }
                  updateSoundPref('browserNotifications', v);
                }}
              />
            </div>

          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}