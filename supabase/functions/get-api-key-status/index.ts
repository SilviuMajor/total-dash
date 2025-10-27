import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth client for user authentication
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Admin client for privileged database operations (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify user is authenticated
    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin using admin client
    const { data: superAdmin } = await adminClient
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keyName } = await req.json();

    if (!keyName) {
      return new Response(
        JSON.stringify({ error: 'keyName is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validKeyNames = ['openai', 'resend', 'stripe', 'stripe_webhook', 'stripe_publishable'];
    if (!validKeyNames.includes(keyName)) {
      return new Response(
        JSON.stringify({ error: 'Invalid keyName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the API key from agency_settings using admin client
    const columnMap: Record<string, string> = {
      'openai': 'openai_api_key',
      'resend': 'resend_api_key',
      'stripe': 'stripe_secret_key',
      'stripe_webhook': 'stripe_webhook_secret',
      'stripe_publishable': 'stripe_publishable_key'
    };
    const columnName = columnMap[keyName];
    
    const { data: settings } = await adminClient
      .from('agency_settings')
      .select(columnName)
      .limit(1)
      .maybeSingle();

    const keyValue = settings?.[columnName as keyof typeof settings];
    const exists = Boolean(keyValue);

    let maskedValue = '';
    if (exists && keyValue) {
      // Mask the key: show first 3 and last 4 characters
      const key = String(keyValue);
      if (key.length > 10) {
        maskedValue = `${key.substring(0, 3)}...${key.substring(key.length - 4)}`;
      } else {
        maskedValue = '***...***';
      }
    }

    console.log(`API key ${keyName} status checked: ${exists ? 'exists' : 'not found'}`);

    return new Response(
      JSON.stringify({ exists, maskedValue: exists ? maskedValue : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-api-key-status function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
