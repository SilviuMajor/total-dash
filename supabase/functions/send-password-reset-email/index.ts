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

    const { userId, email } = await req.json();

    if (!userId && !email) {
      throw new Error('Missing userId or email');
    }

    let targetEmail = email;

    // If userId provided but no email, look up the email
    if (userId && !email) {
      const { data: targetUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (userError || !targetUser) {
        throw new Error('User not found');
      }
      targetEmail = targetUser.user.email;
    }

    if (!targetEmail) {
      throw new Error('Could not determine user email');
    }

    console.log('Sending password reset email to:', targetEmail);

    // Send password reset email using Supabase Auth
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: 'https://total-dash.com/reset-password',
    });

    if (resetError) {
      console.error('Reset email error:', resetError);
      throw resetError;
    }

    // Clear the password hint since user will set a new password
    if (userId) {
      const { error: hintError } = await supabaseAdmin
        .from('user_passwords')
        .update({ password_hint: null })
        .eq('user_id', userId);

      if (hintError) {
        console.error('Error clearing password hint:', hintError);
        // Don't throw - email was sent successfully
      }
    }

    console.log('Password reset email sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Password reset email sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-password-reset-email:', error);
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
