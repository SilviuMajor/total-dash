import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, fullName, role, agencyId } = await req.json();

    console.log('Inviting agency user:', { email, fullName, role, agencyId });

    // Validate required fields
    if (!email || !fullName || !role || !agencyId) {
      throw new Error('Missing required fields');
    }

    // Generate temporary password
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`;

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'agency',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    console.log('Auth user created:', authData.user.id);

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        role: 'agency',
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log('Profile created');

    // Add to agency_users
    const { error: agencyUserError } = await supabase
      .from('agency_users')
      .insert({
        user_id: authData.user.id,
        agency_id: agencyId,
        role: role,
      });

    if (agencyUserError) {
      console.error('Error adding to agency_users:', agencyUserError);
      throw new Error(`Failed to add user to agency: ${agencyUserError.message}`);
    }

    console.log('User added to agency');

    // Store password for retrieval
    const { error: passwordError } = await supabase
      .from('user_passwords')
      .insert({
        user_id: authData.user.id,
        password_text: tempPassword,
      });

    if (passwordError) {
      console.error('Error storing password:', passwordError);
    }

    // Get agency settings for email
    const { data: agencySettings } = await supabase
      .from('agency_settings')
      .select('agency_name, support_email, resend_api_key')
      .eq('agency_id', agencyId)
      .single();

    // Send invitation email if Resend API key is configured
    if (agencySettings?.resend_api_key) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${agencySettings.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: agencySettings.support_email || 'noreply@youragency.com',
            to: email,
            subject: `Invitation to join ${agencySettings?.agency_name || 'the team'}`,
            html: `
              <h2>You've been invited!</h2>
              <p>Hi ${fullName},</p>
              <p>You've been invited to join ${agencySettings?.agency_name || 'the team'} as a ${role}.</p>
              <p>Your login credentials:</p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Temporary Password:</strong> ${tempPassword}</li>
              </ul>
              <p>Please log in and change your password as soon as possible.</p>
              <p>Welcome aboard!</p>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error('Failed to send email:', await emailResponse.text());
        } else {
          console.log('Invitation email sent successfully');
        }
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: authData.user.id,
        tempPassword: tempPassword,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in invite-agency-user function:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
