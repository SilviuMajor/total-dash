import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingData {
  companyName: string;
  logoUrl: string;
  fullLogoUrl: string;
  faviconUrl: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  fullLogoLightUrl?: string;
  fullLogoDarkUrl?: string;
  faviconLightUrl?: string;
  faviconDarkUrl?: string;
}

interface UseBrandingContext {
  isClientView: boolean;
  agencyId?: string;
}

export const useBranding = ({ isClientView, agencyId }: UseBrandingContext) => {
  const [branding, setBranding] = useState<BrandingData>({
    companyName: 'FiveLeaf',
    logoUrl: '',
    fullLogoUrl: '',
    faviconUrl: '/favicon.ico',
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadBranding();
  }, [isClientView, agencyId, isDarkMode]);

  const loadBranding = async () => {
    try {
      // Always fetch platform branding first (base layer)
      const { data: platformData } = await supabase
        .from('platform_branding')
        .select('*')
        .single();

      let finalBranding: BrandingData = {
        companyName: platformData?.company_name || 'FiveLeaf',
        logoLightUrl: platformData?.logo_light_url,
        logoDarkUrl: platformData?.logo_dark_url,
        fullLogoLightUrl: platformData?.full_logo_light_url,
        fullLogoDarkUrl: platformData?.full_logo_dark_url,
        faviconLightUrl: platformData?.favicon_light_url,
        faviconDarkUrl: platformData?.favicon_dark_url,
        logoUrl: '',
        fullLogoUrl: '',
        faviconUrl: '/favicon.ico',
      };

      // If client view and agency ID provided, fetch agency whitelabel (override layer)
      if (isClientView && agencyId) {
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('logo_light_url, logo_dark_url, full_logo_light_url, full_logo_dark_url, favicon_light_url, favicon_dark_url, name')
          .eq('id', agencyId)
          .single();

        if (agencyData) {
          // Override with agency branding if provided (partial override support)
          if (agencyData.logo_light_url) finalBranding.logoLightUrl = agencyData.logo_light_url;
          if (agencyData.logo_dark_url) finalBranding.logoDarkUrl = agencyData.logo_dark_url;
          if (agencyData.full_logo_light_url) finalBranding.fullLogoLightUrl = agencyData.full_logo_light_url;
          if (agencyData.full_logo_dark_url) finalBranding.fullLogoDarkUrl = agencyData.full_logo_dark_url;
          if (agencyData.favicon_light_url) finalBranding.faviconLightUrl = agencyData.favicon_light_url;
          if (agencyData.favicon_dark_url) finalBranding.faviconDarkUrl = agencyData.favicon_dark_url;
          if (agencyData.name) finalBranding.companyName = agencyData.name;
        }
      }

      // Auto-select logo and favicon based on theme
      finalBranding.logoUrl = isDarkMode 
        ? (finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
        : (finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

      // Auto-select full logo based on theme, fallback to sidebar logo if no full logo
      finalBranding.fullLogoUrl = isDarkMode
        ? (finalBranding.fullLogoDarkUrl || finalBranding.fullLogoLightUrl || finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
        : (finalBranding.fullLogoLightUrl || finalBranding.fullLogoDarkUrl || finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

      finalBranding.faviconUrl = isDarkMode
        ? (finalBranding.faviconDarkUrl || finalBranding.faviconLightUrl || '/favicon.ico')
        : (finalBranding.faviconLightUrl || finalBranding.faviconDarkUrl || '/favicon.ico');

      setBranding(finalBranding);
    } catch (error) {
      console.error('Error loading branding:', error);
      // Fallback to defaults on error
      setBranding({
        companyName: 'FiveLeaf',
        logoUrl: '',
        fullLogoUrl: '',
        faviconUrl: '/favicon.ico',
      });
    }
  };

  return branding;
};
