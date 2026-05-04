// whitelabel-domain-actions
//
// Wraps Vercel's project-domain REST API so an agency can register / verify /
// check status of / remove its custom whitelabel domain (e.g. dashboard.fiveleaf.co.uk)
// against the live total-dash Vercel project.
//
// Auth: caller must be a super_admin OR a member of agency_users for the
// target agency. Service-role client validates the JWT, then runs the
// permission check before talking to Vercel.
//
// Required env (Supabase secrets):
//   - VERCEL_TOKEN          (Vercel personal access token, scope: Project Domains R+W)
//   - VERCEL_PROJECT_ID     (prj_xxx for total-dash)
//   - VERCEL_TEAM_ID        (optional; only if project lives under a team)
//
// Frontend invokes:
//   supabase.functions.invoke('whitelabel-domain-actions', { body: { action, agencyId, ... } })

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = 'register' | 'verify' | 'status' | 'remove';

interface RequestBody {
  action: Action;
  agencyId: string;
  // For register: subdomain + domain are taken from the agencies row by default,
  // but the frontend passes them through so we can register without an extra DB roundtrip.
  subdomain?: string;
  domain?: string;
}

interface VercelVerification {
  type: string;
  domain: string;
  value: string;
  reason: string;
}

interface VercelDomainResponse {
  name: string;
  apexName?: string;
  projectId?: string;
  verified: boolean;
  verification?: VercelVerification[];
  createdAt?: number;
  updatedAt?: number;
}

function buildVercelUrl(path: string): string {
  const teamId = Deno.env.get('VERCEL_TEAM_ID');
  const sep = path.includes('?') ? '&' : '?';
  return `https://api.vercel.com${path}${teamId ? `${sep}teamId=${teamId}` : ''}`;
}

async function callVercel(method: string, path: string, body?: object): Promise<{ ok: boolean; status: number; data: any }> {
  const token = Deno.env.get('VERCEL_TOKEN');
  if (!token) {
    return { ok: false, status: 500, data: { error: { message: 'VERCEL_TOKEN not configured' } } };
  }

  const res = await fetch(buildVercelUrl(path), {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // Some endpoints (DELETE) return empty body on success
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}

function buildFqdn(subdomain: string, domain: string): string {
  return `${subdomain.trim().toLowerCase()}.${domain.trim().toLowerCase()}`;
}

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const DOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const projectId = Deno.env.get('VERCEL_PROJECT_ID');

    if (!projectId) {
      throw new Error('VERCEL_PROJECT_ID not configured. Add it to Supabase Edge Function secrets.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Parse + validate request body
    const body: RequestBody = await req.json();
    const { action, agencyId } = body;
    if (!action || !agencyId) {
      throw new Error('action and agencyId are required');
    }
    if (!['register', 'verify', 'status', 'remove'].includes(action)) {
      throw new Error(`Unknown action: ${action}`);
    }

    // 3. Authorise: super_admin OR agency_users member of agencyId
    const [superRes, agencyUserRes] = await Promise.all([
      supabase.from('super_admin_users').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('agency_users').select('user_id').eq('user_id', user.id).eq('agency_id', agencyId).maybeSingle(),
    ]);
    const isAuthorised = !!superRes.data || !!agencyUserRes.data;
    if (!isAuthorised) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: not a member of this agency' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 4. Load agency row (for subdomain/domain when not in body, for status checks)
    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .select('id, slug, whitelabel_subdomain, whitelabel_domain, whitelabel_verified, whitelabel_verified_at')
      .eq('id', agencyId)
      .maybeSingle();
    if (agencyErr || !agency) {
      throw new Error('Agency not found');
    }

    // 5. Dispatch
    if (action === 'register') {
      const sub = (body.subdomain ?? agency.whitelabel_subdomain ?? 'dashboard').trim().toLowerCase();
      const dom = (body.domain ?? agency.whitelabel_domain ?? '').trim().toLowerCase();

      if (!SUBDOMAIN_RE.test(sub)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid subdomain. Use letters, digits and hyphens.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      if (!DOMAIN_RE.test(dom)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid domain. Should look like yourcompany.com.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const fqdn = buildFqdn(sub, dom);

      // Save subdomain/domain to agencies row first (verified=false until Vercel confirms)
      // so a refresh / cross-tab navigation can pick up where we left off.
      const { error: saveErr } = await supabase
        .from('agencies')
        .update({
          whitelabel_subdomain: sub,
          whitelabel_domain: dom,
          whitelabel_verified: false,
          whitelabel_verified_at: null,
        })
        .eq('id', agencyId);
      if (saveErr) throw saveErr;

      const v = await callVercel('POST', `/v10/projects/${projectId}/domains`, { name: fqdn });

      // 409 = domain is already on this Vercel project; treat as a recoverable state
      // and fall through to a status fetch so we still surface verification info.
      if (v.status === 409) {
        const cur = await callVercel('GET', `/v9/projects/${projectId}/domains/${fqdn}`);
        if (cur.ok) {
          return respondWithDomain(cur.data as VercelDomainResponse, supabase, agencyId, agency.whitelabel_verified ?? false);
        }
      }

      if (!v.ok) {
        return new Response(
          JSON.stringify({ success: false, error: vercelErrorMessage(v) }),
          { status: v.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return respondWithDomain(v.data as VercelDomainResponse, supabase, agencyId, agency.whitelabel_verified ?? false);
    }

    if (action === 'verify' || action === 'status') {
      const sub = agency.whitelabel_subdomain;
      const dom = agency.whitelabel_domain;
      if (!sub || !dom) {
        return new Response(
          JSON.stringify({ success: false, error: 'No domain registered for this agency' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      const fqdn = buildFqdn(sub, dom);

      const path = action === 'verify'
        ? `/v9/projects/${projectId}/domains/${fqdn}/verify`
        : `/v9/projects/${projectId}/domains/${fqdn}`;
      const method = action === 'verify' ? 'POST' : 'GET';

      const v = await callVercel(method, path);
      if (!v.ok) {
        return new Response(
          JSON.stringify({ success: false, error: vercelErrorMessage(v) }),
          { status: v.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      return respondWithDomain(v.data as VercelDomainResponse, supabase, agencyId, agency.whitelabel_verified ?? false);
    }

    if (action === 'remove') {
      const sub = agency.whitelabel_subdomain;
      const dom = agency.whitelabel_domain;
      const fqdn = (sub && dom) ? buildFqdn(sub, dom) : null;

      if (fqdn) {
        // Best-effort delete from Vercel; ignore 404 (already gone)
        const v = await callVercel('DELETE', `/v9/projects/${projectId}/domains/${fqdn}`);
        if (!v.ok && v.status !== 404) {
          return new Response(
            JSON.stringify({ success: false, error: vercelErrorMessage(v) }),
            { status: v.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }

      // Always clear the agencies columns even if Vercel had nothing to delete
      const { error: clearErr } = await supabase
        .from('agencies')
        .update({
          whitelabel_subdomain: 'dashboard',
          whitelabel_domain: null,
          whitelabel_verified: false,
          whitelabel_verified_at: null,
        })
        .eq('id', agencyId);
      if (clearErr) throw clearErr;

      return new Response(
        JSON.stringify({ success: true, removed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    throw new Error(`Unhandled action: ${action}`);
  } catch (error) {
    console.error('whitelabel-domain-actions error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

// Maps Vercel error responses (and our own callVercel errors) to a single
// readable string for the frontend.
function vercelErrorMessage(v: { status: number; data: any }): string {
  const code = v.data?.error?.code;
  const apiMsg = v.data?.error?.message;
  if (apiMsg) return `${apiMsg}${code ? ` (${code})` : ''}`;
  return `Vercel API ${v.status}`;
}

// DNS-over-HTTPS lookup for the routing CNAME. Returns true when the
// subdomain has a CNAME chain ending at *.vercel-dns.com — proof that
// browsers asking for this hostname will reach Vercel's edge.
async function checkRouting(fqdn: string): Promise<boolean> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(fqdn)}&type=CNAME`);
    if (!res.ok) return false;
    const data = await res.json();
    const cnames: string[] = (data.Answer || [])
      .filter((r: any) => r.type === 5) // CNAME record
      .map((r: any) => (r.data || '').replace(/\.$/, '').toLowerCase());
    return cnames.some((c) => c.endsWith('vercel-dns.com'));
  } catch {
    return false;
  }
}

// Confirms HTTPS works at the FQDN. Any successful TLS handshake (even
// to a 4xx/5xx) means SSL is provisioned. SSL-handshake errors or
// connection refused means Vercel hasn't issued the cert yet.
async function checkHttps(fqdn: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(`https://${fqdn}/`, {
      method: 'HEAD',
      signal: ctrl.signal,
      redirect: 'manual',
    });
    clearTimeout(t);
    return res.status >= 100 && res.status < 600;
  } catch {
    return false;
  }
}

interface DomainStatus {
  vercelVerified: boolean;
  dnsRouted: boolean;
  httpReady: boolean;
  fullyLive: boolean;
}

// Computes the three-signal status for a Vercel domain object. Network
// checks run in parallel since they're independent.
async function computeStatus(vercelDomain: VercelDomainResponse): Promise<DomainStatus> {
  const fqdn = vercelDomain.name;
  const [dnsRouted, httpReady] = await Promise.all([
    checkRouting(fqdn),
    checkHttps(fqdn),
  ]);
  const vercelVerified = vercelDomain.verified === true;
  return {
    vercelVerified,
    dnsRouted,
    httpReady,
    fullyLive: vercelVerified && dnsRouted && httpReady,
  };
}

// Persists `whitelabel_verified` to match the live status. Sets to true
// only when fullyLive; reverts to false on drift so stale Live claims
// can't poison redirect / branding logic elsewhere in the app.
async function persistLiveState(
  supabase: any,
  agencyId: string,
  fullyLive: boolean,
  previouslyVerified: boolean | null,
): Promise<void> {
  if (fullyLive && !previouslyVerified) {
    const { error } = await supabase
      .from('agencies')
      .update({
        whitelabel_verified: true,
        whitelabel_verified_at: new Date().toISOString(),
      })
      .eq('id', agencyId);
    if (error) console.error('Failed to mark agency verified:', error);
  } else if (!fullyLive && previouslyVerified) {
    const { error } = await supabase
      .from('agencies')
      .update({
        whitelabel_verified: false,
        whitelabel_verified_at: null,
      })
      .eq('id', agencyId);
    if (error) console.error('Failed to revert agency verified state:', error);
  }
}

// Side-effect: persists the live state to the DB based on the multi-signal
// check, then returns the Vercel domain object plus the rich status to
// the frontend.
async function respondWithDomain(
  vercelDomain: VercelDomainResponse,
  supabase: any,
  agencyId: string,
  previouslyVerified: boolean | null,
): Promise<Response> {
  const status = await computeStatus(vercelDomain);
  await persistLiveState(supabase, agencyId, status.fullyLive, previouslyVerified);
  return new Response(
    JSON.stringify({ success: true, domain: vercelDomain, status }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
}
