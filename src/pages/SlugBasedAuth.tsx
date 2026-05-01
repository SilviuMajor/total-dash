import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./Auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isPlatformHost } from "@/lib/whitelabel-host";

export default function SlugBasedAuth() {
  const { agencySlug } = useParams();
  const [agencyContext, setAgencyContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadAgencyContext = async () => {
      if (!agencySlug) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const { data: agency, error } = await supabase.rpc('get_agency_by_slug', {
          p_slug: agencySlug,
        });

        if (error || !agency) {
          console.error('Agency not found:', error);
          setNotFound(true);
          setLoading(false);
          return;
        }

        const a = agency as any;

        // If this agency has a verified custom domain AND we're on the
        // platform host (app.total-dash.com), one-hop to the canonical
        // branded URL. Old bookmarks / shared links keep working; the
        // user just lands on the same login page at their preferred URL.
        const host = window.location.host;
        if (
          a.whitelabel_verified === true &&
          a.whitelabel_domain &&
          isPlatformHost(host)
        ) {
          const sub = a.whitelabel_subdomain || 'dashboard';
          window.location.replace(`https://${sub}.${a.whitelabel_domain}/`);
          return;
        }

        setAgencyContext(agency);
        sessionStorage.setItem('loginAgencyContext', JSON.stringify(agency));
      } catch (e) {
        console.error('Error loading agency:', e);
        setNotFound(true);
      }
      setLoading(false);
    };

    loadAgencyContext();
  }, [agencySlug]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Page not found</CardTitle>
            <CardDescription>
              We couldn't find a login portal for "{agencySlug}". Check the URL with your administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/client/login'}>
              Find your login page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Auth />;
}
