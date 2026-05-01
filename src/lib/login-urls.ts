// Login URL helpers — single source of truth for any UI that displays a
// login URL (AgencySettings, AgencyClientDetails Overview, client Settings,
// AgencyLogin diversion redirect).
//
// Whitelabel awareness: the moment an agency has `whitelabel_verified = true`
// AND a `whitelabel_domain` set, getClientLoginUrl() automatically returns
// the whitelabel URL. No per-page edits required.

export interface AgencyLoginUrlInput {
  slug: string;
  whitelabel_subdomain?: string | null;
  whitelabel_domain?: string | null;
  whitelabel_verified?: boolean | null;
}

const PRODUCTION_ORIGIN = 'https://app.total-dash.com';

function getAppOrigin(): string {
  if (typeof window === 'undefined') return PRODUCTION_ORIGIN;
  // Localhost / Vercel preview deployments use whatever origin we're served
  // from. Production users always see the canonical app domain.
  if (window.location.hostname === 'localhost' || window.location.hostname.endsWith('.vercel.app')) {
    return window.location.origin;
  }
  return PRODUCTION_ORIGIN;
}

// Agency staff login URL. Currently NOT whitelabel-aware — agency staff log
// in at the unbranded app domain. Accepts the agency arg so downstream
// callers don't need to refactor when we whitelabel staff portals.
export function getAgencyLoginUrl(_agency: AgencyLoginUrlInput | null | undefined): string {
  return `${getAppOrigin()}/agency/login`;
}

// Client login URL — whitelabel-aware. If the agency has a verified
// whitelabel domain, returns the bare whitelabel URL (e.g.
// `https://dashboard.example.com`). Otherwise returns the slug-based path
// (`https://app.total-dash.com/login/{slug}`).
//
// Per N13 decision: all clients of an agency share the same agency-slug URL
// (no per-client slug in the displayed URL).
export function getClientLoginUrl(agency: AgencyLoginUrlInput | null | undefined): string {
  if (!agency) return `${getAppOrigin()}/auth`;
  if (agency.whitelabel_verified && agency.whitelabel_domain) {
    const sub = agency.whitelabel_subdomain || 'dashboard';
    return `https://${sub}.${agency.whitelabel_domain}`;
  }
  return `${getAppOrigin()}/login/${agency.slug}`;
}
