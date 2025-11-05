import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReinviteRequest {
  userId: string;
  userType: 'agency' | 'client' | 'super_admin';
  contextId?: string; // agencyId or clientId
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { userId, userType, contextId }: ReinviteRequest = await req.json();

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User not found');
    }

    // Get current password
    const { data: passwordData, error: passwordError } = await supabase
      .from('user_passwords')
      .select('password_text')
      .eq('user_id', userId)
      .single();

    if (passwordError || !passwordData) {
      throw new Error('Password not found for user');
    }

    // Get context-specific data
    let agencyName = null;
    let clientName = null;
    let dashboardUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'lovable.app') || window.location.origin}/`;

    if (userType === 'agency' && contextId) {
      const { data: agency } = await supabase
        .from('agencies')
        .select('name, slug')
        .eq('id', contextId)
        .single();
      
      agencyName = agency?.name;
      dashboardUrl = `${window.location.origin}/agency`;
    } else if (userType === 'client' && contextId) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, slug')
        .eq('id', contextId)
        .single();
      
      clientName = client?.name;
      dashboardUrl = `${window.location.origin}/`;
    } else if (userType === 'super_admin') {
      dashboardUrl = `${window.location.origin}/admin`;
    }

    // Get platform branding
    const { data: branding } = await supabase
      .from('platform_branding')
      .select('company_name')
      .single();

    const platformName = branding?.company_name || 'FiveLeaf';

    // Get support email (try agency settings first, fall back to platform)
    let supportEmail = 'support@fiveleaf.co.uk';
    
    if (contextId && userType === 'agency') {
      const { data: agencySettings } = await supabase
        .from('agency_settings')
        .select('support_email')
        .eq('agency_id', contextId)
        .single();
      
      if (agencySettings?.support_email) {
        supportEmail = agencySettings.support_email;
      }
    }

    // Send welcome email using template
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        templateKey: 'user_invitation_welcome',
        to: profile.email,
        variables: {
          user_name: profile.full_name || profile.email.split('@')[0],
          email: profile.email,
          password: passwordData.password_text,
          dashboard_url: dashboardUrl,
          platform_name: platformName,
          agency_name: agencyName,
          client_name: clientName,
          support_email: supportEmail,
        },
      },
    });

    if (emailError) {
      console.error('Email send error:', emailError);
      throw new Error('Failed to send invitation email');
    }

    // Update password timestamp
    await supabase
      .from('user_passwords')
      .update({ updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Invitation email sent successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error in reinvite-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});