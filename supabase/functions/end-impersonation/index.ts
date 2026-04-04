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

    const body = await req.json();
    const { sessionId, endAll, beacon } = body;

    // For beacon requests (tab close), we can't send auth headers.
    // Accept sessionId as a capability token — the UUID is unguessable.
    if (beacon && sessionId) {
      const { error } = await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .is('ended_at', null);

      if (error) throw error;

      // Also end any child sessions
      await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('parent_session_id', sessionId)
        .is('ended_at', null);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Authenticated path — require auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error('Unauthorized');

    if (endAll) {
      // End all active sessions for this actor (including chained)
      const { error } = await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('actor_id', user.id)
        .is('ended_at', null);

      if (error) throw error;
    } else if (sessionId) {
      // End specific session
      const { error } = await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('actor_id', user.id);

      if (error) throw error;

      // Also end any child sessions
      const { error: childError } = await supabase
        .from('impersonation_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('parent_session_id', sessionId)
        .is('ended_at', null);

      if (childError) console.error('Error ending child sessions:', childError);
    } else {
      // End the most recent active session
      const { data: activeSession } = await supabase
        .from('impersonation_sessions')
        .select('id')
        .eq('actor_id', user.id)
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSession) {
        await supabase
          .from('impersonation_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', activeSession.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in end-impersonation:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
