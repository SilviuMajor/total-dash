import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { hasImpersonationBridge } from "@/lib/impersonation-bridge";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { WrongRoleBanner } from "@/components/WrongRoleBanner";
import {
  type DetectedUserType,
  detectUserTypeAfterAuth,
  loginPathForUserType,
  dashboardPathForUserType,
  userTypeLabel,
} from "@/lib/auth";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mismatchedAs, setMismatchedAs] = useState<DetectedUserType | null>(null);
  const [mismatchedEmail, setMismatchedEmail] = useState<string>("");
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

  // Already-authenticated visitor: matched role → auto-redirect to dashboard
  // (stale-session ergonomics). Mismatched role → render the page normally
  // and surface a WrongRoleBanner so the visitor can view the page, go to
  // their dashboard, or sign out. Skip entirely during impersonation.
  useEffect(() => {
    if (hasImpersonationBridge()) return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const detected = await detectUserTypeAfterAuth(session.user.id);
      if (cancelled) return;
      if (detected.type === 'super_admin') {
        window.location.href = dashboardPathForUserType(detected);
      } else if (detected.type !== 'unknown') {
        setMismatchedAs(detected);
        setMismatchedEmail(session.user.email ?? '');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error("Login failed");

      const detected = await detectUserTypeAfterAuth(data.user.id);

      if (detected.type === 'super_admin') {
        toast.success("Welcome back!");
        navigate("/admin/agencies");
        return;
      }

      // Wrong portal — sign out, redirect to the correct login page.
      await supabase.auth.signOut();
      if (detected.type === 'unknown') {
        toast.error("Access denied. Super admin privileges required.");
        return;
      }
      toast.message("Wrong portal", {
        description: `This is a ${userTypeLabel(detected)} account. Redirecting…`,
      });
      window.location.href = loginPathForUserType(detected);
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {mismatchedAs && (
        <WrongRoleBanner userEmail={mismatchedEmail} detected={mismatchedAs} />
      )}
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
          <p className="text-sm text-muted-foreground mt-1">Platform administration</p>
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