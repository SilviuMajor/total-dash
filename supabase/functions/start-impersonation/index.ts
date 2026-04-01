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
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Unauthorized');

    const { targetType, targetUserId, agencyId, clientId, parentSessionId } = await req.json();

    if (!targetType) throw new Error('Missing targetType');

    // Determine actor type
    const { data: superAdmin } = await supabase
      .from('super_admin_users')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: agencyUser } = await supabase
      .from('agency_users')
      .select('id, agency_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: clientUser } = await supabase
      .from('client_users')
      .select('id, client_id')
      .eq('user_id', user.id)
      .maybeSingle();

    let actorType = 'unknown';
    if (superAdmin) actorType = 'super_admin';
    else if (agencyUser) actorType = 'agency_user';
    else if (clientUser) actorType = 'client_user';

    // Permission checks
    if (actorType === 'unknown') throw new Error('Cannot determine actor type');

    if (actorType === 'client_user') {
      // Client users can only impersonate within their own client
      if (clientId !== clientUser?.client_id) throw new Error('Cannot access other clients');
      if (targetType === 'agency_user') throw new Error('Cannot impersonate upward');
      // Must be admin tier to view as other users
      const { data: permRow } = await supabase
        .from('client_user_agent_permissions')
        .select('role_id')
        .eq('user_id', user.id)
        .eq('client_id', clientId)
        .limit(1)
        .maybeSingle();
      if (permRow?.role_id) {
        const { data: role } = await supabase
          .from('client_roles')
          .select('is_admin_tier')
          .eq('id', permRow.role_id)
          .single();
        if (!role?.is_admin_tier) throw new Error('Only admins can view as other users');
      }
    }

    if (actorType === 'agency_user') {
      // Agency users can only impersonate their own clients
      if (clientId) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('agency_id')
          .eq('id', clientId)
          .single();
        if (clientData?.agency_id !== agencyUser?.agency_id) throw new Error('Cannot access other agency clients');
      }
      if (targetType === 'super_admin') throw new Error('Cannot impersonate upward');
    }

    // Close any existing active sessions for this actor
    await supabase
      .from('impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('actor_id', user.id)
      .is('ended_at', null);

    // Get actor name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, full_name')
      .eq('id', user.id)
      .single();
    const actorName = profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown';

    // Get target user name if viewing as specific user
    let targetUserName = null;
    if (targetUserId) {
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name')
        .eq('id', targetUserId)
        .single();
      targetUserName = targetProfile?.full_name || `${targetProfile?.first_name || ''} ${targetProfile?.last_name || ''}`.trim() || 'Unknown';
    }

    const mode = targetUserId ? 'view_as_user' : 'full_access';

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from('impersonation_sessions')
      .insert({
        actor_id: user.id,
        actor_type: actorType,
        actor_name: actorName,
        target_type: targetType,
        target_user_id: targetUserId || null,
        target_user_name: targetUserName,
        agency_id: agencyId || agencyUser?.agency_id || null,
        client_id: clientId || null,
        parent_session_id: parentSessionId || null,
        mode,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({ success: true, session }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in start-impersonation:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
