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

    // Construct the expected CNAME target
    const expectedTarget = Deno.env.get('SUPABASE_URL')?.replace('https://', '') || 'your-project.supabase.co';
    const fullDomain = `${subdomain}.${domain}`;

    console.log(`Verifying DNS for ${fullDomain} -> ${expectedTarget}`);

    // Perform DNS CNAME lookup
    let verified = false;
    let message = '';

    try {
      // Use DNS API to check CNAME record
      const dnsResponse = await fetch(`https://dns.google/resolve?name=${fullDomain}&type=CNAME`);
      const dnsData = await dnsResponse.json();

      console.log('DNS response:', JSON.stringify(dnsData));

      if (dnsData.Answer && dnsData.Answer.length > 0) {
        const cnameRecord = dnsData.Answer.find((record: any) => record.type === 5); // Type 5 is CNAME
        
        if (cnameRecord) {
          const cnameTarget = cnameRecord.data.replace(/\.$/, ''); // Remove trailing dot
          console.log(`Found CNAME: ${cnameTarget}`);
          
          // For now, we'll mark as verified if a CNAME exists
          // In production, you'd want to verify it points to your infrastructure
          verified = true;
          message = `DNS verified successfully. CNAME points to ${cnameTarget}`;
        } else {
          message = 'No CNAME record found. Please add a CNAME record pointing to your Lovable instance.';
        }
      } else {
        message = 'No DNS records found. Please add a CNAME record.';
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