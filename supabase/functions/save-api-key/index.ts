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

    console.log('User authenticated:', user.id, user.email);
    console.log('Super admin check:', { hasSuperAdmin: !!superAdmin });

    if (!superAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { keyType, apiKey } = await req.json();

    if (!keyType || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'keyType and apiKey are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedKeys = ['openai', 'resend', 'stripe', 'stripe_webhook', 'stripe_publishable'];
    if (!allowedKeys.includes(keyType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid keyType' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Validate key format
    const keyValidation: Record<string, string> = {
      'openai': 'sk-',
      'resend': 're_',
      'stripe': 'sk_',
      'stripe_webhook': 'whsec_',
      'stripe_publishable': 'pk_'
    };
    
    const expectedPrefix = keyValidation[keyType];
    if (expectedPrefix && !apiKey.startsWith(expectedPrefix)) {
      return new Response(
        JSON.stringify({ error: `Invalid ${keyType} API key format. Expected key starting with "${expectedPrefix}"` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the API key in agency_settings table using admin client
    const { data: existingSettings } = await adminClient
      .from('agency_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const columnMap: Record<string, string> = {
      'openai': 'openai_api_key',
      'resend': 'resend_api_key',
      'stripe': 'stripe_secret_key',
      'stripe_webhook': 'stripe_webhook_secret',
      'stripe_publishable': 'stripe_publishable_key'
    };
    const columnName = columnMap[keyType];

    console.log('Saving API key:', { keyType, columnName, hasExistingSettings: !!existingSettings });

    if (existingSettings) {
      const { error } = await adminClient
        .from('agency_settings')
        .update({ [columnName]: apiKey })
        .eq('id', existingSettings.id);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }
    } else {
      const { error } = await adminClient
        .from('agency_settings')
        .insert({ [columnName]: apiKey });

      if (error) {
        console.error('Database insert error:', error);
        throw error;
      }
    }

    console.log(`API key ${keyType} saved successfully`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in save-api-key function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
