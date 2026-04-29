import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import {
  detectUserTypeAfterAuth,
  loginPathForUserType,
  dashboardPathForUserType,
  userTypeLabel,
} from "@/lib/auth";

export default function AgencyLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [diverting, setDiverting] = useState(false);
  const [diversionUrl, setDiversionUrl] = useState<string | null>(null);
  const navigate = useNavigate();
  const branding = useBranding({ isClientView: false, agencyId: undefined, appTheme: 'light' });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  // Already-authenticated visitor: bounce to right place. Skip during
  // impersonation so super_admin can revisit login pages without disruption.
  useEffect(() => {
    if (sessionStorage.getItem('preview_mode') === '1') return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const detected = await detectUserTypeAfterAuth(session.user.id);
      if (cancelled) return;
      if (detected.type === 'agency') {
        window.location.href = dashboardPathForUserType(detected);
      } else if (detected.type !== 'unknown') {
        window.location.href = loginPathForUserType(detected);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDiverting(false);
    setDiversionUrl(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Invalid email or password");
      }

      const detected = await detectUserTypeAfterAuth(data.user.id);

      if (detected.type === 'agency') {
        const { data: passwordData } = await supabase.functions.invoke('check-must-change-password', {
          body: {}
        });

        if (passwordData?.mustChangePassword) {
          toast.success("Please set a new password");
          navigate("/change-password");
          return;
        }

        toast.success("Welcome back!");
        navigate("/agency");
        return;
      }

      // Wrong portal — sign out then redirect.
      // For client users we additionally honour whitelabel domains: the
      // agency's whitelabel subdomain is the "right" client login URL
      // when verified, not the path-based slug.
      if (detected.type === 'client') {
        const { data: agencyRow } = await supabase
          .from('agencies')
          .select('whitelabel_domain, whitelabel_subdomain, whitelabel_verified, slug')
          .eq('slug', detected.agencySlug ?? '')
          .maybeSingle();

        await supabase.auth.signOut();

        const a: any = agencyRow ?? {};
        const redirectUrl = (a.whitelabel_verified && a.whitelabel_domain)
          ? `https://${a.whitelabel_subdomain || 'dashboard'}.${a.whitelabel_domain}`
          : loginPathForUserType(detected);
        setDiverting(true);
        setDiversionUrl(redirectUrl);
        return;
      }

      await supabase.auth.signOut();

      if (detected.type === 'super_admin') {
        toast.message("Wrong portal", {
          description: "This is a super admin account. Redirecting…",
        });
        window.location.href = loginPathForUserType(detected);
        return;
      }

      throw new Error("No agency found for this account. Please contact your administrator.");

    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  // Use the light logo variant for the dark header
  const headerLogoUrl = branding.fullLogoLightUrl || branding.fullLogoUrl;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md overflow-hidden border-border/50">
        {/* Dark branded header */}
        <div className="bg-foreground px-8 py-8 text-center">
          {headerLogoUrl ? (
            <div className="flex justify-center mb-3">
              <img src={headerLogoUrl} alt={branding.companyName} className="h-10 w-auto object-contain brightness-0 invert" />
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-xl bg-background/10 flex items-center justify-center text-background text-xl font-bold">
                {(branding.companyName || 'A').charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <h1 className="text-lg font-semibold text-background">Agency portal</h1>
          <p className="text-sm text-background/60 mt-0.5">Manage your clients and agents</p>
        </div>
        
        <CardContent className="pt-6 pb-8 px-8">
          {diverting && diversionUrl ? (
            <div className="text-center space-y-4 py-4">
              <div className="flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  <line x1="12" y1="2" x2="12" y2="4" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Wrong portal</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account is registered as a client user. We'll take you to the right place.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  if (diversionUrl.startsWith('http')) {
                    window.location.href = diversionUrl;
                  } else {
                    navigate(diversionUrl, { replace: true });
                  }
                }}
              >
                Go to your login page
              </Button>
              <button onClick={() => { setDiverting(false); setDiversionUrl(null); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Try a different account
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="agency-email">Email</Label>
                  <Input
                    id="agency-email"
                    type="email"
                    placeholder="you@agency.com"
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
                    <Label htmlFor="agency-password">Password</Label>
                    <ForgotPasswordDialog />
                  </div>
                  <Input
                    id="agency-password"
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
              <p className="text-center text-sm text-muted-foreground mt-4">
                Looking for your client dashboard?{' '}
                <a href="/client/login" className="text-foreground hover:underline font-medium">Find your portal</a>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}