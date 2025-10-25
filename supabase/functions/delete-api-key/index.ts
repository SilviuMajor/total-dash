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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated and is admin
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super admin
    const { data: superAdmin } = await supabaseClient
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

    const { keyType } = await req.json();

    if (!keyType) {
      return new Response(
        JSON.stringify({ error: 'keyType is required' }),
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

    // Delete the API key from agency_settings
    const columnMap: Record<string, string> = {
      'openai': 'openai_api_key',
      'resend': 'resend_api_key',
      'stripe': 'stripe_secret_key',
      'stripe_webhook': 'stripe_webhook_secret',
      'stripe_publishable': 'stripe_publishable_key'
    };
    const columnName = columnMap[keyType];

    const { data: existingSettings } = await supabaseClient
      .from('agency_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingSettings) {
      const { error } = await supabaseClient
        .from('agency_settings')
        .update({ [columnName]: null })
        .eq('id', existingSettings.id);

      if (error) throw error;
    }

    console.log(`API key ${keyType} deleted successfully`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in delete-api-key function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
