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
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify super admin
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    
    if (!user) throw new Error('Unauthorized');
    
    const { data: isSuperAdmin } = await supabaseAdmin
      .rpc('is_super_admin', { _user_id: user.id });
    
    if (!isSuperAdmin) throw new Error('Super admin access required');

    // Find orphaned users (in auth.users but not in profiles)
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id');
    
    const profileIds = new Set(profiles?.map(p => p.id) || []);
    
    // Get all auth users
    const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
    
    const orphanedUsers = authUsers.filter(u => !profileIds.has(u.id));
    
    console.log(`Found ${orphanedUsers.length} orphaned users`);
    
    // Delete orphaned users
    const deletedUsers = [];
    for (const user of orphanedUsers) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(user.id);
        deletedUsers.push({ id: user.id, email: user.email });
        console.log(`Deleted orphaned user: ${user.email}`);
      } catch (err) {
        console.error(`Failed to delete ${user.email}:`, err);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        orphanedCount: orphanedUsers.length,
        deletedUsers
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Cleanup error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
