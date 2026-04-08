import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

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

      // Check if they're an agency user
      const { data: agencyUsers, error: agencyUserError } = await supabase
        .from('agency_users')
        .select('agency_id, role')
        .eq('user_id', data.user.id);

      if (agencyUserError) {
        console.error("Agency lookup error:", agencyUserError);
        throw new Error("Failed to verify agency access. Please try again.");
      }

      if (agencyUsers && agencyUsers.length > 0) {
        // They ARE an agency user — proceed normally
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

      // Not an agency user — check if they're a client user and redirect
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id, clients!inner(agency_id, agencies!inner(slug))')
        .eq('user_id', data.user.id)
        .maybeSingle();

      // Sign them out — they're in the wrong portal
      await supabase.auth.signOut();

      if (clientUser && (clientUser as any).clients?.agencies) {
        const agency = (clientUser as any).clients.agencies;
        const redirectUrl = `/${agency.slug}`;
        setDiverting(true);
        setDiversionUrl(redirectUrl);
        return;
      }

      // Not in agency_users OR client_users
      throw new Error("No agency found for this account. Please contact your administrator.");

    } catch (error: any) {
      console.error("Login error:", error);
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {branding.fullLogoUrl && (
            <div className="flex justify-center mb-4">
              <img
                src={branding.fullLogoUrl}
                alt={branding.companyName}
                className="h-10 object-contain"
              />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl">
              {branding.companyName} Agency Portal
            </CardTitle>
            <CardDescription>
              Sign in to access your agency portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {diverting && diversionUrl ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                This account is registered as a client user, not an agency user.
              </p>
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
              <button
                onClick={() => { setDiverting(false); setDiversionUrl(null); }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Try a different account
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
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
                  <Label htmlFor="password">Password</Label>
                  <ForgotPasswordDialog />
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}