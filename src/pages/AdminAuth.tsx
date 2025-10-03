import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { signIn, signUp } from "@/lib/auth";
import fiveleafLogo from "@/assets/fiveleaf-logo.png";

export default function AdminAuth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, fullName, 'admin');
        if (error) throw error;
        
        toast({
          title: "Account created",
          description: "Please check your email to confirm your account.",
        });
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        
        navigate("/admin/clients");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md p-8 bg-gradient-card border-border/50">
        <div className="flex flex-col items-center mb-8">
          <img src={fiveleafLogo} alt="Fiveleaf" className="h-16 w-16 object-contain mb-4" />
          <h1 className="text-3xl font-semibold text-foreground">Fiveleaf</h1>
          <p className="text-muted-foreground mt-2">Agency Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground text-center">
              {isSignUp ? "Create Admin Account" : "Admin Sign In"}
            </h2>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="bg-muted/50"
              />
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-muted/50"
            />
          </div>

          <div className="space-y-2">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-muted/50"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Loading..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>

          <div className="text-center space-y-2">
            <Button
              type="button"
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </Button>
            
            <div className="pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/client/auth")}
                className="text-sm text-primary hover:text-primary/80"
              >
                Client Login →
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}