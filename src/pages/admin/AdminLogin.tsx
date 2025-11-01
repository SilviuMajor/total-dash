import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useBranding } from "@/hooks/useBranding";

export default function SuperAdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { effectiveTheme } = useTheme();
  const branding = useBranding({ isClientView: false, agencyId: undefined, appTheme: effectiveTheme });

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
        // Verify super admin status
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
      toast.error(error.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {branding.fullLogoUrl && (
            <div className="flex justify-center mb-4">
              <img 
                src={branding.fullLogoUrl} 
                alt={branding.companyName} 
                className="h-16 w-auto object-contain" 
              />
            </div>
          )}
          <CardTitle className="text-3xl font-bold text-center">Admin</CardTitle>
          <CardDescription className="text-center">
            Sign in to manage your platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@yourcompany.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
        </CardContent>
      </Card>
    </div>
  );
}
