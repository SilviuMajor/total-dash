// get-client-users edge function
// Fetch client users with profiles and departments, bypassing RLS for preview super admins

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
      console.error('[get-client-users] Missing or invalid Authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: authUser, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !authUser?.user) {
      console.error('[get-client-users] Auth error:', authErr);
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { clientId } = await req.json().catch(() => ({ clientId: null }));
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'clientId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify super admin
    const { data: isSuperAdmin, error: superErr } = await supabaseAdmin.rpc('is_super_admin', {
      _user_id: authUser.user.id,
    });
    if (superErr) {
      console.error('[get-client-users] is_super_admin RPC error:', superErr);
      return new Response(JSON.stringify({ error: 'Authorization check failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!isSuperAdmin) {
      console.warn('[get-client-users] User is not super admin:', authUser.user.id);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    console.log('[get-client-users] Fetching users for clientId:', clientId);

    // Fetch client users with profiles and departments
    const { data: users, error: usersErr } = await supabaseAdmin
      .from('client_users')
      .select(`
        id,
        user_id,
        full_name,
        avatar_url,
        department_id,
        profiles:profiles(email),
        departments:departments(name, color)
      `)
      .eq('client_id', clientId);

    if (usersErr) {
      console.error('[get-client-users] Error fetching client_users:', usersErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const userIds = (users || []).map((u: any) => u.user_id);
    let rolesByUser: Record<string, string[]> = {};
    if (userIds.length > 0) {
      const { data: roles, error: rolesErr } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .eq('client_id', clientId)
        .in('user_id', userIds);

      if (rolesErr) {
        console.error('[get-client-users] Error fetching roles:', rolesErr);
      } else {
        rolesByUser = roles.reduce((acc: Record<string, string[]>, r: any) => {
          acc[r.user_id] = acc[r.user_id] || [];
          acc[r.user_id].push(r.role);
          return acc;
        }, {});
      }
    }

    const result = (users || []).map((u: any) => ({
      id: u.id,
      user_id: u.user_id,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      department_id: u.department_id,
      profiles: u.profiles || null,
      departments: u.departments || null,
      roles: rolesByUser[u.user_id] || [],
    }));

    return new Response(JSON.stringify({ users: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[get-client-users] Unexpected error:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

Deno.serve(handler);
