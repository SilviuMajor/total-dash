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

    const { email, firstName, lastName, role, agencyId, password } = await req.json();

    console.log('Inviting agency user:', { email, firstName, lastName, role, agencyId });

    // Validate required fields
    if (!email || !firstName || !lastName || !role || !agencyId || !password) {
      throw new Error('Missing required fields: email, firstName, lastName, role, agencyId, password');
    }

    // Use provided password
    const tempPassword = password;

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
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
        first_name: firstName,
        last_name: lastName,
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

    // Get agency and platform branding
    const { data: agency } = await supabase
      .from('agencies')
      .select('name, slug')
      .eq('id', agencyId)
      .single();

    const { data: branding } = await supabase
      .from('platform_branding')
      .select('company_name')
      .single();

    const platformName = branding?.company_name || 'FiveLeaf';
    const dashboardUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || 'http://localhost:8080'}/agency`;

    // Get support email
    const { data: agencySettings } = await supabase
      .from('agency_settings')
      .select('support_email')
      .eq('agency_id', agencyId)
      .single();

    const supportEmail = agencySettings?.support_email || 'support@fiveleaf.co.uk';

    // Send welcome email using template
    try {
      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          templateKey: 'user_invitation_welcome',
          to: email,
          variables: {
            user_name: `${firstName} ${lastName}`,
            email: email,
            password: tempPassword,
            dashboard_url: dashboardUrl,
            platform_name: platformName,
            agency_name: agency?.name,
            support_email: supportEmail,
          },
        },
      });

      if (emailError) {
        console.error('Failed to send email:', emailError);
      } else {
        console.log('Invitation email sent successfully');
      }
    } catch (emailError) {
      console.error('Error sending invitation email:', emailError);
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
