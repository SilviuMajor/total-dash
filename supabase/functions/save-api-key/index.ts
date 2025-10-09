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

    const { keyName, keyValue } = await req.json();

    if (!keyName || !keyValue) {
      return new Response(
        JSON.stringify({ error: 'keyName and keyValue are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (keyName !== 'OPENAI_API_KEY' && keyName !== 'ELEVENLABS_API_KEY') {
      return new Response(
        JSON.stringify({ error: 'Invalid keyName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store the API key in agency_settings table
    const { data: existingSettings } = await supabaseClient
      .from('agency_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    const columnName = keyName === 'OPENAI_API_KEY' ? 'openai_api_key' : 'elevenlabs_api_key';

    if (existingSettings) {
      const { error } = await supabaseClient
        .from('agency_settings')
        .update({ [columnName]: keyValue })
        .eq('id', existingSettings.id);

      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('agency_settings')
        .insert({ [columnName]: keyValue });

      if (error) throw error;
    }

    console.log(`API key ${keyName} saved successfully`);

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
