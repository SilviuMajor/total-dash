import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signIn } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import { useFavicon } from "@/hooks/useFavicon";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  const [loginAgencyId, setLoginAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (isPreviewMode) return;
    
    const checkAndRedirect = async () => {
      if (user && profile) {
        try {
          const { data } = await supabase.functions.invoke('check-must-change-password', {
            body: {}
          });
          
          if (data?.mustChangePassword) {
            navigate('/change-password');
            return;
          }
        } catch (error) {
          console.error('Error checking password change requirement:', error);
        }
        
        if (profile.role === 'admin') {
          navigate('/admin/agencies');
        } else {
          navigate('/');
        }
      }
    };
    
    checkAndRedirect();
  }, [user, profile, navigate, isPreviewMode]);

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

      // Check if user is a client user
      const { data: clientUser } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (clientUser) {
        // They ARE a client user — let the existing useEffect redirect handle it
        toast({
          title: "Success",
          description: "Signed in successfully",
        });
        return;
      }

      // Not a client user — check what they actually are and redirect
      await supabase.auth.signOut();

      // Check super admin
      const { data: superAdmin } = await supabase
        .from('super_admin_users')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (superAdmin) {
        toast({
          title: "Wrong portal",
          description: "This is a client login page. Redirecting you to admin login.",
        });
        setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
        return;
      }

      // Check agency user
      const { data: agencyUser } = await supabase
        .from('agency_users')
        .select('id')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (agencyUser) {
        toast({
          title: "Wrong portal",
          description: "This is a client login page. Redirecting you to agency login.",
        });
        setTimeout(() => { window.location.href = '/agency/login'; }, 1500);
        return;
      }

      // Not a client, admin, or agency user at all
      toast({
        title: "Error",
        description: "No client account found for this email. Please contact your administrator.",
        variant: "destructive",
      });
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {isPreviewMode && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-amber-950 text-center py-2 text-sm font-medium z-50">
          Preview Mode — This is how your clients see the login page
        </div>
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