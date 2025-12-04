import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import { useFavicon } from "@/hooks/useFavicon";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { supabase } from "@/integrations/supabase/client";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check if this is a preview mode view
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  // Get agency context from sessionStorage (set by SlugBasedAuth)
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
  
  // Use branding with agency ID if available
  const branding = useBranding({ 
    isClientView: true, 
    agencyId: loginAgencyId || undefined 
  });
  
  // Apply favicon
  useFavicon(branding.faviconUrl || '');

  useEffect(() => {
    // Don't redirect in preview mode - allow viewing the login page
    if (isPreviewMode) return;
    
    const checkAndRedirect = async () => {
      if (user && profile) {
        // Check if user must change password
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
        
        // Redirect based on role
        if (profile.role === 'admin') {
          navigate('/admin/agencies');
        } else {
          // Client users redirect to their dashboard
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
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Account created successfully. Please sign in.",
        });
        setIsSignUp(false);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Signed in successfully",
        });
      }
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
      {/* Preview Mode Banner */}
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
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {isSignUp 
                ? "Enter your details to create your account" 
                : "Enter your credentials to access your dashboard"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="bg-muted/50 border-border"
                />
              </div>
            )}
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
            {!isSignUp && (
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
            )}
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-foreground text-background hover:bg-foreground/90"
            >
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isSignUp 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Sign up"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
