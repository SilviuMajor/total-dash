import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./Auth";

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

      const { data: agency, error } = await supabase
        .from('agencies')
        .select('id, name, logo_light_url, logo_dark_url, full_logo_light_url, full_logo_dark_url, favicon_light_url, favicon_dark_url, primary_color, secondary_color, slug')
        .eq('slug', agencySlug)
        .single();
      
      if (error || !agency) {
        console.error('Agency not found:', error);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAgencyContext(agency);
      // Store in sessionStorage for the auth flow and branding
      sessionStorage.setItem('loginAgencyContext', JSON.stringify(agency));
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
    return <Navigate to="/client/login" replace />;
  }

  // Render Auth page with agency branding context available via sessionStorage
  return <Auth />;
}
