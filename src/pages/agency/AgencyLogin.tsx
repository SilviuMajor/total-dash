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
import { PhoneNumberInput } from "@/components/ui/phone-input";
import { isValidPhoneNumber } from "react-phone-number-input";
import { useBranding } from "@/hooks/useBranding";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";

export default function AgencyLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [emailError, setEmailError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const branding = useBranding({ isClientView: false, agencyId: undefined, appTheme: 'light' });

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email change with validation
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
      // Step 1: Authenticate user
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw new Error("Invalid email or password");
      }

      // Step 2: Verify agency association
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
        throw new Error("No agency found for this account. Please sign up first.");
      }

      // Step 3: Success - redirect
      toast.success("Welcome back!");
      navigate("/agency");
      
    } catch (error: any) {
      console.error("Login error:", error);
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
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            role: 'admin',
          },
          emailRedirectTo: `${window.location.origin}/agency`,
        },
      });

      if (error) throw error;

      if (data.user) {
        // Create agency slug from name
        const slug = agencyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if slug already exists
        const { data: existingAgency } = await supabase
          .from('agencies')
          .select('id')
          .eq('slug', slug)
          .maybeSingle();

        if (existingAgency) {
          throw new Error(`Agency name "${agencyName}" is already taken. Please choose a different name.`);
        }

        // Create agency with phone number
        const { data: agencyData, error: agencyError } = await supabase
          .from('agencies')
          .insert({
            name: agencyName,
            slug: slug,
            owner_id: data.user.id,
            contact_phone: phoneNumber,
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
          console.error("Trial setup error:", trialError);
          toast.warning(
            "Account created successfully! Trial setup pending - please contact support if you don't receive a welcome email.",
            { duration: 5000 }
          );
        } else {
          toast.success("Account created! Your 7-day trial has started. Check your email for details.");
        }

        // Redirect after edge function completes
        navigate("/agency");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      
      // Check for specific error types
      if (error.message?.includes("duplicate") || error.code === "23505") {
        toast.error("An account with this email already exists. Please sign in instead.");
      } else if (error.message?.includes("invalid email")) {
        toast.error("Please enter a valid email address.");
      } else if (error.message?.includes("password")) {
        toast.error("Password must be at least 6 characters.");
      } else if (error.message?.includes("Agency name") && error.message?.includes("taken")) {
        toast.error(error.message);
      } else {
        toast.error(error.message || "Failed to create account. Please try again.");
      }
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
              Create your agency account or sign in
            </CardDescription>
          </div>
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
                  <Label htmlFor="login-email">Email *</Label>
                  <Input
                    id="login-email"
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
                    <Label htmlFor="login-password">Password *</Label>
                    <ForgotPasswordDialog />
                  </div>
                  <Input
                    id="login-password"
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
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-firstname">First Name *</Label>
                    <Input
                      id="signup-firstname"
                      type="text"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-lastname">Last Name *</Label>
                    <Input
                      id="signup-lastname"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-agency">Agency Name *</Label>
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
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input
                    id="signup-email"
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
                  <Label htmlFor="signup-phone">Phone Number *</Label>
                  <PhoneNumberInput
                    value={phoneNumber}
                    onChange={(value) => setPhoneNumber(value || "")}
                    required
                    placeholder="+1 (555) 123-4567"
                    disabled={loading}
                  />
                  {phoneNumber && !isValidPhoneNumber(phoneNumber) && (
                    <p className="text-sm text-destructive">
                      Please enter a valid phone number
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
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
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={
                    loading || 
                    !email || 
                    !!emailError || 
                    !password || 
                    !agencyName || 
                    !firstName || 
                    !lastName || 
                    !phoneNumber ||
                    (phoneNumber && !isValidPhoneNumber(phoneNumber))
                  }
                >
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
