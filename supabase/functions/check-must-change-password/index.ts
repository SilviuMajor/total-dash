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

    // Check if user must change password
    const { data, error } = await supabaseAdmin
      .from('user_passwords')
      .select('must_change_password')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking must_change_password:', error);
      throw error;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        mustChangePassword: data?.must_change_password || false
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-must-change-password:', error);
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
