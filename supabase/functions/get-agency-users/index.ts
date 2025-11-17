// get-agency-users edge function
// Fetch agency users with profiles, bypassing RLS for preview super admins

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[get-agency-users] Missing or invalid Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authUser?.user) {
      console.error('[get-agency-users] Auth error:', authErr);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { agencyId } = await req.json().catch(() => ({ agencyId: null }));
    if (!agencyId) {
      return new Response(JSON.stringify({ error: 'agencyId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify super admin
    const { data: isSuperAdmin, error: superErr } = await supabaseAdmin.rpc('is_super_admin', {
      _user_id: authUser.user.id,
    });
    if (superErr) {
      console.error('[get-agency-users] is_super_admin RPC error:', superErr);
      return new Response(JSON.stringify({ error: 'Authorization check failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!isSuperAdmin) {
      console.warn('[get-agency-users] User is not super admin:', authUser.user.id);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[get-agency-users] Fetching users for agencyId:', agencyId);

    // Fetch agency users with profiles
    const { data: agencyUsers, error: usersErr } = await supabaseAdmin
      .from('agency_users')
      .select('id, user_id, role, created_at')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (usersErr) {
      console.error('[get-agency-users] Error fetching agency_users:', usersErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let result: any[] = [];
    if (agencyUsers && agencyUsers.length > 0) {
      const userIds = agencyUsers.map((u: any) => u.user_id);
      const { data: profiles, error: profilesErr } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, first_name, last_name, updated_at')
        .in('id', userIds);

      if (profilesErr) {
        console.error('[get-agency-users] Error fetching profiles:', profilesErr);
      }

      result = agencyUsers.map((u: any) => ({
        id: u.id,
        user_id: u.user_id,
        role: u.role,
        created_at: u.created_at,
        profile: profiles?.find((p: any) => p.id === u.user_id) || {
          email: '',
          full_name: null,
          first_name: null,
          last_name: null,
          updated_at: new Date().toISOString(),
        },
      }));
    }

    return new Response(JSON.stringify({ users: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[get-agency-users] Unexpected error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

Deno.serve(handler);
