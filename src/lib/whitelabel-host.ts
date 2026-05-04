// Helpers for resolving the current browser host to a whitelabel agency.
//
// Used by the App.tsx bootstrap and ClientLoginRedirect to decide whether
// the visitor is on a custom domain (e.g. dashboard.fiveleaf.co.uk) and,
// if so, which agency owns it. Anonymous-readable via the
// get_agency_by_whitelabel_fqdn RPC (see migration 20260501000000).

import { supabase } from "@/integrations/supabase/client";

export interface WhitelabelAgency {
  id: string;
  name: string;
  slug: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  full_logo_light_url: string | null;
  full_logo_dark_url: string | null;
  favicon_light_url: string | null;
  favicon_dark_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

// Hosts that should NEVER be treated as a whitelabel custom domain, no matter
// what's in the database.
export function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === 'app.total-dash.com' || host === 'total-dash.com' || host === 'www.total-dash.com') return true;
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return true;
  if (host.endsWith('.vercel.app')) return true;
  return false;
}

// Returns the agency that owns the given hostname, or null if none does.
// SECURITY DEFINER RPC strictly returns only the safe branding fields.
export async function lookupAgencyByHost(host: string): Promise<WhitelabelAgency | null> {
  if (isPlatformHost(host)) return null;
  try {
    const { data, error } = await supabase.rpc('get_agency_by_whitelabel_fqdn', { p_fqdn: host });
    if (error) {
      console.error('lookupAgencyByHost RPC error:', error);
      return null;
    }
    return (data as WhitelabelAgency | null) ?? null;
  } catch (err) {
    console.error('lookupAgencyByHost failed:', err);
    return null;
  }
}
