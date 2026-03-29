import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authorization: verify requester is super admin, agency admin/owner, or client admin
    const requestingUserId = user.id;

    const { data: isSuperAdmin } = await supabaseAdmin
      .from('super_admin_users')
      .select('id')
      .eq('user_id', requestingUserId)
      .single();

    if (!isSuperAdmin) {
      const { data: isAgencyAdmin } = await supabaseAdmin
        .from('agency_users')
        .select('role')
        .eq('user_id', requestingUserId)
        .in('role', ['owner', 'admin'])
        .single();

      if (!isAgencyAdmin) {
        const { data: isClientAdmin } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', requestingUserId)
          .eq('role', 'admin')
          .single();

        if (!isClientAdmin) {
          return new Response(
            JSON.stringify({ success: false, error: 'Forbidden' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Only return must_change_password flag — no password hints
    const { data, error } = await supabaseAdmin
      .from('user_passwords')
      .select('must_change_password')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user password data:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        hint: null,
        mustChangePassword: data?.must_change_password || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-user-password:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
