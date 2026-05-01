// useCustomDomainAgency
//
// Runs once on app mount. If the browser is on a custom whitelabel domain
// (e.g. dashboard.fiveleaf.co.uk), looks up the owning agency and:
//   1) Stores it as `loginAgencyContext` in sessionStorage so the existing
//      Auth.tsx branding pipeline (useBranding({ isClientView, agencyId }))
//      picks it up — same mechanism SlugBasedAuth uses for /login/:slug.
//   2) Exposes `{ agency, loading, isCustomDomain, isUnknownDomain }` so
//      callers can render an error page when the host isn't claimed.
//
// Single source of truth for "what agency does this host belong to". The
// rest of the app reads loginAgencyContext via the existing branding chain.

import { useEffect, useState } from "react";
import {
  isPlatformHost,
  lookupAgencyByHost,
  type WhitelabelAgency,
} from "@/lib/whitelabel-host";

interface UseCustomDomainAgencyResult {
  agency: WhitelabelAgency | null;
  loading: boolean;
  isCustomDomain: boolean;
  isUnknownDomain: boolean; // custom domain but no agency claims it
}

export function useCustomDomainAgency(): UseCustomDomainAgencyResult {
  const host = typeof window !== 'undefined' ? window.location.host : '';
  const platform = isPlatformHost(host);
  const [agency, setAgency] = useState<WhitelabelAgency | null>(null);
  const [loading, setLoading] = useState(!platform);
  const [isUnknownDomain, setIsUnknownDomain] = useState(false);

  useEffect(() => {
    if (platform) return;
    let cancelled = false;
    (async () => {
      const result = await lookupAgencyByHost(host);
      if (cancelled) return;
      if (result) {
        setAgency(result);
        try {
          sessionStorage.setItem('loginAgencyContext', JSON.stringify(result));
        } catch {
          // localStorage / sessionStorage can throw in private browsing
        }
      } else {
        setIsUnknownDomain(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [host, platform]);

  return {
    agency,
    loading,
    isCustomDomain: !platform,
    isUnknownDomain,
  };
}
