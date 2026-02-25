import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for domain context (5 minute TTL)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain, path } = await req.json();
    
    if (!domain || !path) {
      throw new Error('Domain and path are required');
    }

    // Check for Cloudflare Worker proxy headers (custom domain support)
    const originalHost = req.headers.get('x-original-host') || 
                         req.headers.get('x-forwarded-host') || 
                         null;

    // Check cache first
    const cacheKey = `${domain}:${path}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log('Returning cached context for:', cacheKey);
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Normalize domain (remove port, protocol)
    const normalizedDomain = domain.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    
    let contextType: string;
    let agencySlug: string | null = null;
    let clientSlug: string | null = null;
    let whitelabelConfig: any = null;

    // If we have an original host from Cloudflare proxy, use it to look up agency
    if (originalHost) {
      const normalizedOriginalHost = originalHost.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      console.log('Custom domain detected via proxy header:', normalizedOriginalHost);
      
      // Extract the base domain (remove subdomain like "dashboard.")
      const domainParts = normalizedOriginalHost.split('.');
      // For "dashboard.fiveleaf.co.uk" -> "fiveleaf.co.uk"
      const baseDomain = domainParts.length > 2 ? domainParts.slice(1).join('.') : normalizedOriginalHost;
      
      const { data: whitelabelAgency } = await supabase
        .from('agencies')
        .select('id, slug, name, logo_url, primary_color, secondary_color, whitelabel_subdomain, whitelabel_domain')
        .eq('whitelabel_verified', true)
        .eq('whitelabel_domain', baseDomain)
        .single();

      if (whitelabelAgency) {
        contextType = 'client';
        agencySlug = whitelabelAgency.slug;
        whitelabelConfig = {
          agencyId: whitelabelAgency.id,
          agencyName: whitelabelAgency.name,
          logoUrl: whitelabelAgency.logo_url,
          primaryColor: whitelabelAgency.primary_color,
          secondaryColor: whitelabelAgency.secondary_color,
        };

        // Extract client slug from path if present
        const pathParts = path.split('/').filter((p: string) => p);
        if (pathParts.length > 0 && pathParts[0] !== 'login' && pathParts[0] !== 'client') {
          clientSlug = pathParts[0];
        }
      } else {
        // Custom domain not found, fall back to default
        contextType = 'agency';
      }
    }
    // Check if it's super admin domain
    else if (normalizedDomain.startsWith('admin.') || path.startsWith('/super-admin')) {
      contextType = 'super_admin';
    }
    // Check if it's a whitelabel domain (direct, non-proxy)
    else {
      const { data: whitelabelAgency } = await supabase
        .from('agencies')
        .select('id, slug, name, logo_url, primary_color, secondary_color, whitelabel_subdomain, whitelabel_domain')
        .eq('whitelabel_verified', true)
        .or(`whitelabel_domain.eq.${normalizedDomain}`)
        .single();

      if (whitelabelAgency) {
        // This is a whitelabel client domain
        contextType = 'client';
        agencySlug = whitelabelAgency.slug;
        whitelabelConfig = {
          agencyId: whitelabelAgency.id,
          agencyName: whitelabelAgency.name,
          logoUrl: whitelabelAgency.logo_url,
          primaryColor: whitelabelAgency.primary_color,
          secondaryColor: whitelabelAgency.secondary_color,
        };

        // Extract client slug from path if present
        const pathParts = path.split('/').filter((p: string) => p);
        if (pathParts.length > 0 && pathParts[0] !== 'login') {
          clientSlug = pathParts[0];
        }
      }
      // Check if it's main domain with agency/client paths
      else if (normalizedDomain.includes('total-dash.com') || normalizedDomain.includes('localhost')) {
        const pathParts = path.split('/').filter((p: string) => p);
        
        if (path.startsWith('/agencylogin') || path.startsWith('/agency')) {
          contextType = 'agency';
        } else if (pathParts.length > 0) {
          // First path part could be agency slug
          const potentialAgencySlug = pathParts[0];
          
          // Check if this is a valid agency slug
          const { data: agency } = await supabase
            .from('agencies')
            .select('id, slug, name, logo_url, primary_color, secondary_color')
            .eq('slug', potentialAgencySlug)
            .single();

          if (agency) {
            agencySlug = agency.slug;
            
            // Check if second path part is 'login' or a client slug
            if (pathParts.length === 1 || pathParts[1] === 'login') {
              contextType = 'agency';
            } else if (pathParts.length > 1) {
              // This is a client context
              contextType = 'client';
              clientSlug = pathParts[1];
              
              whitelabelConfig = {
                agencyId: agency.id,
                agencyName: agency.name,
                logoUrl: agency.logo_url,
                primaryColor: agency.primary_color,
                secondaryColor: agency.secondary_color,
              };
            } else {
              contextType = 'agency';
            }
          } else {
            // Unknown path, default to agency
            contextType = 'agency';
          }
        } else {
          contextType = 'agency';
        }
      } else {
        // Default to agency context
        contextType = 'agency';
      }
    }

    const result = {
      contextType,
      agencySlug,
      clientSlug,
      whitelabelConfig,
    };

    // Cache the result
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    // Clean up old cache entries
    if (cache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-domain-context:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});