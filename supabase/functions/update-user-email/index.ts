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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authorization required');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error('Invalid authentication token');

    const { userId, newEmail } = await req.json();
    if (!userId || !newEmail) throw new Error('Missing userId or newEmail');

    // Verify caller has permission (super admin, agency user, or self)
    if (caller.id !== userId) {
      const { data: isSuperAdmin } = await supabaseAdmin.rpc('is_super_admin', { _user_id: caller.id });
      if (!isSuperAdmin) {
        const { data: agencyAccess } = await supabaseAdmin
          .from('agency_users')
          .select('agency_id')
          .eq('user_id', caller.id)
          .single();
        if (!agencyAccess) throw new Error('Unauthorized');
      }
    }

    // Update auth email
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updateError) throw updateError;

    // Update profile email
    await supabaseAdmin.from('profiles').update({ email: newEmail }).eq('id', userId);

    // Send password setup email to new address
    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || 'https://total-dash.com';
    await supabaseAdmin.auth.resetPasswordForEmail(newEmail, {
      redirectTo: `${siteUrl}/change-password`,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
