import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  const [loginAgencyId, setLoginAgencyId] = useState<string | null>(null);
  
  useEffect(() => {
    const storedContext = sessionStorage.getItem('loginAgencyContext');
    if (storedContext) {
      try {
        const agency = JSON.parse(storedContext);
        setLoginAgencyId(agency.id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Signed in successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
        <CardHeader className="space-y-4 text-center">
          {branding.fullLogoUrl && (
            <div className="flex justify-center">
              <img src={branding.fullLogoUrl} alt={branding.companyName} className="h-16 w-auto object-contain" />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enter your credentials to access your dashboard
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-muted/50 border-border"
              />
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
                className="bg-muted/50 border-border"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? "Please wait..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
