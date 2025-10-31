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
  appTheme?: 'light' | 'dark';
}

export const useBranding = ({ isClientView, agencyId, appTheme = 'light' }: UseBrandingContext) => {
  const [branding, setBranding] = useState<BrandingData>({
    companyName: 'FiveLeaf',
    logoUrl: '',
    fullLogoUrl: '',
    faviconUrl: '/favicon.ico',
  });
  const [systemTheme, setSystemTheme] = useState(false);

  // Detect system theme for favicon only
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    loadBranding();
  }, [isClientView, agencyId, appTheme, systemTheme]);

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

      // Select logos based on APP THEME (user's toggle)
      finalBranding.logoUrl = appTheme === 'dark' 
        ? (finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
        : (finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

      // Select full logo based on APP THEME, fallback to sidebar logo if no full logo
      finalBranding.fullLogoUrl = appTheme === 'dark'
        ? (finalBranding.fullLogoDarkUrl || finalBranding.fullLogoLightUrl || finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
        : (finalBranding.fullLogoLightUrl || finalBranding.fullLogoDarkUrl || finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

      // Select favicon based on SYSTEM THEME (independent of app theme toggle)
      finalBranding.faviconUrl = systemTheme
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
