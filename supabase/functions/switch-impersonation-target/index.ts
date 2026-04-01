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

    const { sessionId, targetUserId } = await req.json();

    if (!sessionId) throw new Error('Missing sessionId');

    // Verify the session belongs to this actor
    const { data: session, error: sessionError } = await supabase
      .from('impersonation_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('actor_id', user.id)
      .is('ended_at', null)
      .single();

    if (sessionError || !session) throw new Error('Active session not found');

    // Determine new mode and target name
    let newMode = 'full_access';
    let targetUserName = null;

    if (targetUserId) {
      newMode = 'view_as_user';
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, full_name')
        .eq('id', targetUserId)
        .single();
      targetUserName = targetProfile?.full_name || `${targetProfile?.first_name || ''} ${targetProfile?.last_name || ''}`.trim() || 'Unknown';
    }

    // Update session
    const { data: updated, error: updateError } = await supabase
      .from('impersonation_sessions')
      .update({
        target_user_id: targetUserId || null,
        target_user_name: targetUserName,
        mode: newMode,
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, session: updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in switch-impersonation-target:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
