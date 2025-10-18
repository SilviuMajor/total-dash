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

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
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

    if (keyName !== 'OPENAI_API_KEY' && keyName !== 'RESEND_API_KEY') {
      return new Response(
        JSON.stringify({ error: 'Invalid keyName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the API key from agency_settings
    const columnName = keyName === 'OPENAI_API_KEY' ? 'openai_api_key' : 'resend_api_key';
    
    const { data: settings } = await supabaseClient
      .from('agency_settings')
      .select(columnName)
      .limit(1)
      .maybeSingle();

    const keyValue = settings?.[columnName];
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
