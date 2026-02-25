import { useEffect, useState } from "react";
import { useBrandingQuery } from "@/hooks/queries/useBrandingQuery";

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
  const [systemTheme, setSystemTheme] = useState(false);

  // Detect system theme for favicon only
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const { data: queryData } = useBrandingQuery(agencyId);

  if (!queryData) {
    return {
      companyName: 'FiveLeaf',
      logoUrl: '',
      fullLogoUrl: '',
      faviconUrl: '/favicon.ico',
    } as BrandingData;
  }

  const { platformData, agencyData } = queryData;

  let finalBranding: BrandingData = {
    companyName: platformData?.company_name || 'FiveLeaf',
    logoLightUrl: platformData?.logo_light_url ?? undefined,
    logoDarkUrl: platformData?.logo_dark_url ?? undefined,
    fullLogoLightUrl: platformData?.full_logo_light_url ?? undefined,
    fullLogoDarkUrl: platformData?.full_logo_dark_url ?? undefined,
    faviconLightUrl: platformData?.favicon_light_url ?? undefined,
    faviconDarkUrl: platformData?.favicon_dark_url ?? undefined,
    logoUrl: '',
    fullLogoUrl: '',
    faviconUrl: '/favicon.ico',
  };

  if (agencyData) {
    if (agencyData.logo_light_url) finalBranding.logoLightUrl = agencyData.logo_light_url;
    if (agencyData.logo_dark_url) finalBranding.logoDarkUrl = agencyData.logo_dark_url;
    if (agencyData.full_logo_light_url) finalBranding.fullLogoLightUrl = agencyData.full_logo_light_url;
    if (agencyData.full_logo_dark_url) finalBranding.fullLogoDarkUrl = agencyData.full_logo_dark_url;
    if (agencyData.name) finalBranding.companyName = agencyData.name;

    if (isClientView) {
      if (agencyData.favicon_light_url) finalBranding.faviconLightUrl = agencyData.favicon_light_url;
      if (agencyData.favicon_dark_url) finalBranding.faviconDarkUrl = agencyData.favicon_dark_url;
    }
  }

  // Select logos based on APP THEME
  finalBranding.logoUrl = appTheme === 'dark'
    ? (finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
    : (finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

  finalBranding.fullLogoUrl = appTheme === 'dark'
    ? (finalBranding.fullLogoDarkUrl || finalBranding.fullLogoLightUrl || finalBranding.logoDarkUrl || finalBranding.logoLightUrl || '')
    : (finalBranding.fullLogoLightUrl || finalBranding.fullLogoDarkUrl || finalBranding.logoLightUrl || finalBranding.logoDarkUrl || '');

  // Select favicon based on SYSTEM THEME
  finalBranding.faviconUrl = systemTheme
    ? (finalBranding.faviconDarkUrl || '/favicon.ico')
    : (finalBranding.faviconLightUrl || '/favicon.ico');

  return finalBranding;
};
