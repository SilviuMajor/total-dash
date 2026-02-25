import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agencyId, domain, subdomain = 'dashboard' } = await req.json();
    
    if (!agencyId || !domain) {
      throw new Error('Agency ID and domain are required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // The Cloudflare Worker URL that agencies should CNAME to
    const cloudflareWorkerUrl = Deno.env.get('CLOUDFLARE_WORKER_URL') || '';
    const fullDomain = `${subdomain}.${domain}`;

    console.log(`Verifying DNS for ${fullDomain}`);
    if (cloudflareWorkerUrl) {
      console.log(`Expected CNAME target: ${cloudflareWorkerUrl}`);
    }

    // Perform DNS CNAME lookup
    let verified = false;
    let message = '';

    try {
      // Use Google DNS API to check CNAME record
      const dnsResponse = await fetch(`https://dns.google/resolve?name=${fullDomain}&type=CNAME`);
      const dnsData = await dnsResponse.json();

      console.log('DNS response:', JSON.stringify(dnsData));

      if (dnsData.Answer && dnsData.Answer.length > 0) {
        const cnameRecord = dnsData.Answer.find((record: any) => record.type === 5); // Type 5 is CNAME
        
        if (cnameRecord) {
          const cnameTarget = cnameRecord.data.replace(/\.$/, ''); // Remove trailing dot
          console.log(`Found CNAME: ${cnameTarget}`);
          
          // If we have a Cloudflare Worker URL configured, verify it matches
          if (cloudflareWorkerUrl) {
            const normalizedTarget = cnameTarget.toLowerCase();
            const normalizedExpected = cloudflareWorkerUrl.toLowerCase().replace(/^https?:\/\//, '');
            
            if (normalizedTarget === normalizedExpected || normalizedTarget.endsWith(`.${normalizedExpected}`)) {
              verified = true;
              message = `DNS verified successfully. CNAME correctly points to ${cnameTarget}`;
            } else {
              message = `CNAME record found but points to ${cnameTarget} instead of ${cloudflareWorkerUrl}. Please update your CNAME record.`;
            }
          } else {
            // No Cloudflare Worker URL configured yet, accept any CNAME
            verified = true;
            message = `DNS verified successfully. CNAME points to ${cnameTarget}`;
          }
        } else {
          message = 'No CNAME record found. Please add a CNAME record pointing to the provided target.';
        }
      } else {
        message = 'No DNS records found for this domain. Please add a CNAME record and wait for DNS propagation (5-10 minutes).';
      }
    } catch (dnsError) {
      console.error('DNS lookup error:', dnsError);
      const errorMsg = dnsError instanceof Error ? dnsError.message : 'Unknown DNS error';
      message = `DNS verification failed: ${errorMsg}. Please ensure the CNAME record is properly configured.`;
    }

    // Update agency record
    const { error: updateError } = await supabase
      .from('agencies')
      .update({
        whitelabel_verified: verified,
        whitelabel_verified_at: verified ? new Date().toISOString() : null,
      })
      .eq('id', agencyId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ verified, message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in verify-whitelabel-domain:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ verified: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
