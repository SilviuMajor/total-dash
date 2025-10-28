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
      throw new Error('Unauthorized');
    }

    const { userId, newPassword, oldPassword, isAdminReset } = await req.json();

    if (!userId || !newPassword) {
      throw new Error('Missing required fields: userId and newPassword');
    }

    console.log('Resetting password for user:', userId);

    // Get the requesting user and target user details
    const requestingUserId = user.id;
    
    // Check if this is a self-service password change (requires old password verification)
    const isSelfService = !isAdminReset && requestingUserId === userId;
    
    if (isSelfService) {
      if (!oldPassword) {
        throw new Error('Current password is required for self-service password change');
      }
      
      // Get user email for verification
      const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !targetUser) {
        throw new Error('User not found');
      }
      
      // Verify old password is correct by attempting sign in
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: targetUser.user.email!,
        password: oldPassword,
      });
      
      if (signInError) {
        throw new Error('Current password is incorrect');
      }
    } else {
      // This is an admin reset - verify permissions
      const isSuperAdmin = await supabaseAdmin
        .from('super_admin_users')
        .select('id')
        .eq('user_id', requestingUserId)
        .single();
      
      const isAgencyOwnerOrAdmin = await supabaseAdmin
        .from('agency_users')
        .select('role')
        .eq('user_id', requestingUserId)
        .in('role', ['owner', 'admin'])
        .single();
      
      const isClientAdmin = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', requestingUserId)
        .eq('role', 'admin')
        .single();
      
      if (!isSuperAdmin.data && !isAgencyOwnerOrAdmin.data && !isClientAdmin.data) {
        throw new Error('Unauthorized to reset this password');
      }
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (authError) {
      console.error('Auth password update error:', authError);
      throw authError;
    }

    console.log('Auth password updated successfully');

    // Update password in user_passwords table
    const { error: dbError } = await supabaseAdmin
      .from('user_passwords')
      .update({ password_text: newPassword })
      .eq('user_id', userId);

    if (dbError) {
      console.error('Database password update error:', dbError);
      throw dbError;
    }

    console.log('Password reset completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reset-user-password:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
