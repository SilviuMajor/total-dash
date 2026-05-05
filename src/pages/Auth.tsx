import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  type DetectedUserType,
  detectUserTypeAfterAuth,
  loginPathForUserType,
  dashboardPathForUserType,
  userTypeLabel,
} from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import { useFavicon } from "@/hooks/useFavicon";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { WrongRoleBanner } from "@/components/WrongRoleBanner";
import { supabase } from "@/integrations/supabase/client";
import { hasImpersonationBridge } from "@/lib/impersonation-bridge";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  const [loginAgencyId, setLoginAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [mismatchedAs, setMismatchedAs] = useState<DetectedUserType | null>(null);
  const [mismatchedEmail, setMismatchedEmail] = useState<string>("");
  
  useEffect(() => {
    const storedContext = sessionStorage.getItem('loginAgencyContext');
    if (storedContext) {
      try {
        const agency = JSON.parse(storedContext);
        setLoginAgencyId(agency.id);
        setAgencyName(agency.name);
      } catch (e) {
        console.error('Error parsing agency context:', e);
      }
    }
  }, []);
  
  const branding = useBranding({ 
    isClientView: true, 
    agencyId: loginAgencyId || undefined 
  });
  
  useFavicon(branding.faviconUrl || '');

  // Already-authenticated visitor: matched role (client) → auto-redirect to
  // dashboard (stale-session ergonomics). Mismatched role → render the page
  // normally and surface a WrongRoleBanner so the visitor can view branded
  // login pages, go to their dashboard, or sign out. Skip during
  // preview/impersonation and during the explicit ?preview=true UX.
  useEffect(() => {
    if (isPreviewMode) return;
    if (hasImpersonationBridge()) return;
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('check-must-change-password', {
          body: {},
        });
        if (cancelled) return;
        if (data?.mustChangePassword) {
          navigate('/change-password');
          return;
        }
      } catch (error) {
        console.error('Error checking password change requirement:', error);
      }

      const detected = await detectUserTypeAfterAuth(user.id);
      if (cancelled) return;
      if (detected.type === 'client') {
        navigate(dashboardPathForUserType(detected));
      } else if (detected.type !== 'unknown') {
        setMismatchedAs(detected);
        setMismatchedEmail(user.email ?? '');
      }
    })();

    return () => { cancelled = true; };
  }, [user, navigate, isPreviewMode]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Login failed");

      const detected = await detectUserTypeAfterAuth(data.user.id);

      if (detected.type === 'client') {
        toast({
          title: "Success",
          description: "Signed in successfully",
        });
        return;
      }

      // Wrong portal — sign out, redirect to the correct login page.
      await supabase.auth.signOut();

      if (detected.type === 'unknown') {
        toast({
          title: "Error",
          description: "No client account found for this email. Please contact your administrator.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Wrong portal",
        description: `This is a ${userTypeLabel(detected)} account. Redirecting…`,
      });
      window.location.href = loginPathForUserType(detected);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {isPreviewMode && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-amber-950 text-center py-2 text-sm font-medium z-50">
          Preview Mode — This is how your clients see the login page
        </div>
      )}

      {mismatchedAs && !isPreviewMode && (
        <WrongRoleBanner userEmail={mismatchedEmail} detected={mismatchedAs} />
      )}

      <Card className={`w-full max-w-md bg-gradient-card border-border/50 ${isPreviewMode ? 'mt-8' : ''}`}>
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-6">
            {branding.fullLogoUrl ? (
              <div className="flex justify-center mb-4">
                <img src={branding.fullLogoUrl} alt={branding.companyName} className="h-16 w-auto object-contain" />
              </div>
            ) : (
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                  {(agencyName || branding.companyName || 'D').charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your {agencyName || branding.companyName} dashboard
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <ForgotPasswordDialog />
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
        </CardContent>
      </Card>
    </div>
  );
}