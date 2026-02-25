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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Invalid email or password");
      }

      const { data: agencyUsers, error: agencyUserError } = await supabase
        .from('agency_users')
        .select('agency_id, role')
        .eq('user_id', data.user.id);

      if (agencyUserError) {
        console.error("Agency lookup error:", agencyUserError);
        throw new Error("Failed to verify agency access. Please try again.");
      }

      if (!agencyUsers || agencyUsers.length === 0) {
        await supabase.auth.signOut();
        throw new Error("No agency found for this account. Please contact your administrator.");
      }

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
        <CardHeader className="space-y-4">
          {branding.fullLogoUrl && (
            <div className="flex justify-center">
              <img 
                src={branding.fullLogoUrl} 
                alt={branding.companyName} 
                className="h-12 object-contain" 
              />
            </div>
          )}
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center">
              {branding.companyName} Agency Portal
            </CardTitle>
            <CardDescription className="text-center">
              Sign in to access your agency portal
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
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
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !email || !!emailError || !password}
            >
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
        </CardContent>
      </Card>
    </div>
  );
}
