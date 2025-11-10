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
      console.error('Missing Authorization header');
      throw new Error('Authorization header required');
    }

    // Extract Bearer token
    const jwtToken = authHeader.replace('Bearer ', '');
    if (!jwtToken) {
      console.error('Invalid Authorization header format');
      throw new Error('Invalid Authorization header format');
    }

    const { contextType, agencyId, clientId, isPreview = false } = await req.json();
    
    if (!contextType) {
      throw new Error('Context type is required');
    }

    // Use admin client to validate the token directly
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from token using admin client
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwtToken);
    if (userError || !user) {
      console.error('Token validation failed:', userError?.message || 'No user found');
      throw new Error('Invalid authentication');
    }

    console.log('User authenticated successfully:', user.id);

    // Check if user is a super admin (needed for preview mode bypass)
    const { data: superAdminRec } = await supabaseAdmin
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();
    const isSuperAdmin = !!superAdminRec;

    if (contextType === 'super_admin') {
      // Verify user is a super admin
      if (!isSuperAdmin) {
        throw new Error('User is not a super admin');
      }
    } else if (contextType === 'agency') {
      if (!agencyId) {
        throw new Error('Agency ID required for agency context');
      }

      // Super admins in preview mode can access any agency
      if (!(isSuperAdmin && isPreview)) {
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
      } else {
        console.log('Super admin preview: bypassing agency membership validation', { 
          userId: user.id, 
          agencyId 
        });
      }
    } else if (contextType === 'client') {
      if (!clientId) {
        throw new Error('Client ID required for client context');
      }

      // Super admins in preview mode can access any client
      if (!(isSuperAdmin && isPreview)) {
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
      } else {
        console.log('Super admin preview: bypassing client membership validation', { 
          userId: user.id, 
          clientId 
        });
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