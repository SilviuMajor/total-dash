import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AgencyLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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
        // Verify agency user status
        const { data: agencyUserData, error: agencyError } = await supabase
          .from('agency_users')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (agencyError || !agencyUserData) {
          await supabase.auth.signOut();
          toast.error("Access denied. Agency account required.");
          setLoading(false);
          return;
        }

        toast.success("Welcome back!");
        navigate("/agency");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create user account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'admin',
          },
          emailRedirectTo: `${window.location.origin}/agency`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create agency slug from name
        const slug = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Create agency
        const { data: agencyData, error: agencyError } = await supabase
          .from('agencies')
          .insert({
            name: agencyName,
            slug: slug,
            owner_id: data.user.id,
            trial_ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          })
          .select()
          .single();

        if (agencyError) throw agencyError;

        // Create agency user
        const { error: agencyUserError } = await supabase
          .from('agency_users')
          .insert({
            user_id: data.user.id,
            agency_id: agencyData.id,
            role: 'owner',
            page_permissions: {
              clients: true,
              agents: true,
              subscription: true,
              settings: true,
            },
          });

        if (agencyUserError) throw agencyUserError;

        // Create trial subscription via edge function
        try {
          const { data: trialData, error: trialError } = await supabase.functions.invoke(
            'create-trial-subscription',
            {
              body: {
                agencyId: agencyData.id,
                userEmail: email,
              },
            }
          );

          if (trialError) {
            console.error("Trial subscription setup failed:", trialError);
            // Don't fail signup if trial setup fails
          }

          toast.success("Account created! Your 7-day trial has started. Check your email for details.");
        } catch (trialError) {
          console.error("Trial subscription error:", trialError);
          toast.success("Account created! Please complete payment setup.");
        }

        navigate("/agency");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold text-center">Agency Portal</CardTitle>
          <CardDescription className="text-center">
            Create your agency account or sign in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signup" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="login">Sign In</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
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
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-agency">Agency Name</Label>
                  <Input
                    id="signup-agency"
                    type="text"
                    placeholder="Your Agency"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@agency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Start 7-Day Free Trial"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  No credit card required for trial
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
