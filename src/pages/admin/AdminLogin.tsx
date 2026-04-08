import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const branding = useBranding({ isClientView: false, agencyId: undefined, appTheme: effectiveTheme });

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: superAdminData, error: superAdminError } = await supabase
          .from('super_admin_users')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (superAdminError || !superAdminData) {
          await supabase.auth.signOut();
          toast.error("Access denied. Super admin privileges required.");
          setLoading(false);
          return;
        }

        toast.success("Welcome back!");
        navigate("/admin/agencies");
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        {/* Header — stacked logo, title, subtitle */}
        <div className="mb-8">
          {branding.fullLogoUrl ? (
            <img 
              src={branding.fullLogoUrl} 
              alt={branding.companyName} 
              className="h-8 w-auto object-contain mb-4" 
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-foreground flex items-center justify-center mb-4">
              <span className="text-background font-medium text-sm">T</span>
            </div>
          )}
          <h1 className="text-xl font-semibold text-foreground">Admin</h1>
            <p className="text-xs text-muted-foreground">Platform administration</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="you@totaldash.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              required
              disabled={loading}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="admin-password">Password</Label>
              <ForgotPasswordDialog />
            </div>
            <Input
              id="admin-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-foreground text-background hover:bg-foreground/90">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}