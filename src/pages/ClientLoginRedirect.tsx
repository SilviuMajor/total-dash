import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformHost, lookupAgencyByHost } from "@/lib/whitelabel-host";

export default function ClientLoginRedirect() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // If we're on a custom whitelabel domain (e.g. dashboard.fiveleaf.co.uk),
  // skip the email-find-portal step entirely and jump to the branded
  // login. Visitors should never see this unbranded page on a custom domain.
  useEffect(() => {
    const host = window.location.host;
    if (isPlatformHost(host)) return;
    let cancelled = false;
    (async () => {
      const agency = await lookupAgencyByHost(host);
      if (cancelled) return;
      if (agency) {
        navigate(`/login/${agency.slug}`, { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleFindPortal = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: lookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (lookupError || !data) {
        setError("No account found with this email. Please check with your administrator.");
        setLoading(false);
        return;
      }

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('client_id, clients!inner(agency_id, agencies!inner(slug))')
        .eq('user_id', data.id)
        .maybeSingle();

      if (!clientUser || !(clientUser as any).clients?.agencies?.slug) {
        setError("No client portal found for this email. Please check with your administrator.");
        setLoading(false);
        return;
      }

      const slug = (clientUser as any).clients.agencies.slug;
      navigate(`/login/${slug}`, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Find Your Login Portal</CardTitle>
          <CardDescription>
            Enter your email and we'll redirect you to your company's login page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFindPortal(); }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <Button className="w-full" onClick={handleFindPortal} disabled={loading || !email.trim()}>
            {loading ? "Looking up..." : "Find My Portal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
