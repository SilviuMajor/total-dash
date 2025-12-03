import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useBranding } from "@/hooks/useBranding";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTheme } = useTheme();
  const branding = useBranding({ isClientView: true, appTheme: effectiveTheme });

  useEffect(() => {
    // Check if we have a valid recovery token
    const checkToken = async () => {
      const hashParams = new URLSearchParams(location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');

      if (type === 'recovery' && accessToken) {
        setIsValidToken(true);
      } else {
        toast.error("Invalid or expired reset link");
        setTimeout(() => {
          navigate('/client/login');
        }, 2000);
      }
      setCheckingToken(false);
    };

    checkToken();
  }, [location, navigate]);

  const determineLoginRedirect = async (userId: string): Promise<string> => {
    try {
      // Check if user is an agency user
      const { data: agencyUser } = await supabase
        .from('agency_users')
        .select('agency_id')
        .eq('user_id', userId)
        .single();

      if (agencyUser) {
        return '/agency/login';
      }

      // Check if user is a client user
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id, clients(agency_id)')
        .eq('user_id', userId)
        .single();

      if (clientUser?.clients?.agency_id) {
        // Get agency info for proper redirect
        const { data: agency } = await supabase
          .from('agencies')
          .select('slug, whitelabel_domain, whitelabel_subdomain, whitelabel_verified')
          .eq('id', clientUser.clients.agency_id)
          .single();

        if (agency?.whitelabel_verified && agency?.whitelabel_domain) {
          const subdomain = agency.whitelabel_subdomain || 'dashboard';
          return `https://${subdomain}.${agency.whitelabel_domain}/client/login`;
        } else if (agency?.slug) {
          return `https://total-dash.com/login/${agency.slug}`;
        }
      }

      // Default fallback
      return '/client/login';
    } catch (error) {
      console.error('Error determining redirect:', error);
      return '/client/login';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Get current user before update
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully! Please sign in with your new password.");
      
      // Determine the correct login page based on user type
      let redirectUrl = '/client/login';
      if (user?.id) {
        redirectUrl = await determineLoginRedirect(user.id);
      }
      
      // Sign out to clear the recovery session
      await supabase.auth.signOut();
      
      // Redirect to appropriate login page
      setTimeout(() => {
        if (redirectUrl.startsWith('http')) {
          window.location.href = redirectUrl;
        } else {
          navigate(redirectUrl);
        }
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isValidToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border/50">
        <CardHeader className="space-y-4 text-center">
          {branding.fullLogoUrl && (
            <div className="flex justify-center">
              <img 
                src={branding.fullLogoUrl} 
                alt={branding.companyName} 
                className="h-16 w-auto object-contain" 
              />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Reset Your Password
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your new password below
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                  className="bg-muted/50 border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 6 characters
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  className="bg-muted/50 border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive">
                  Passwords do not match
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}