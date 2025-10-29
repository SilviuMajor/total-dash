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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const { contextType, agencyId, clientId, isPreview = false } = await req.json();
    
    if (!contextType) {
      throw new Error('Context type is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Invalid authentication');
    }

    // Validate context permissions
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (contextType === 'super_admin') {
      // Verify user is a super admin
      const { data: superAdmin } = await supabaseAdmin
        .from('super_admin_users')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!superAdmin) {
        throw new Error('User is not a super admin');
      }
    } else if (contextType === 'agency') {
      if (!agencyId) {
        throw new Error('Agency ID required for agency context');
      }

      // Verify user belongs to this agency
      const { data: agencyUser } = await supabaseAdmin
        .from('agency_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('agency_id', agencyId)
        .single();

      if (!agencyUser) {
        throw new Error('User does not belong to this agency');
      }
    } else if (contextType === 'client') {
      if (!clientId) {
        throw new Error('Client ID required for client context');
      }

      // Verify user belongs to this client
      const { data: clientUser } = await supabaseAdmin
        .from('client_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('client_id', clientId)
        .single();

      if (!clientUser) {
        throw new Error('User does not belong to this client');
      }
    }

    // Generate unique token
    const token = crypto.randomUUID();
    
    // Set expiration (1 hour for preview mode, 7 days for regular)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (isPreview ? 1 : 168));

    // Clean up any existing expired contexts for this user
    await supabaseAdmin
      .from('auth_contexts')
      .delete()
      .eq('user_id', user.id)
      .lt('expires_at', new Date().toISOString());

    // Store auth context
    const { error: insertError } = await supabaseAdmin
      .from('auth_contexts')
      .insert({
        user_id: user.id,
        context_type: contextType,
        agency_id: agencyId || null,
        client_id: clientId || null,
        token,
        expires_at: expiresAt.toISOString(),
        is_preview: isPreview,
      });

    if (insertError) {
      console.error('Error inserting auth context:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        token,
        expiresAt: expiresAt.toISOString(),
        contextType,
        agencyId,
        clientId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in authenticate-with-context:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});