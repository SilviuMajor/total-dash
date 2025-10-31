import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error("Authentication failed");

    console.log("Authenticated user:", user.id);

    // Check if user is super admin
    const { data: superAdminData, error: superAdminError } = await supabaseAdmin
      .from('super_admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single();

    console.log("Super admin check:", { superAdminData, superAdminError });

    if (!superAdminData) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use database function to get billing data
    const { data: agencies, error } = await supabaseAdmin
      .rpc('get_billing_data_detailed');

    if (error) {
      console.error("Database query error:", error);
      throw error;
    }

    console.log(`Fetched ${agencies?.length || 0} agencies`);

    // Format the data
    const formatted = agencies?.map((agency: any) => {
      // Determine plan name with custom indicator
      let planName = 'No Plan';
      if (agency.subscription_status) {
        if (agency.is_custom_pricing) {
          planName = `${agency.plan_name || 'Custom Plan'} (Custom)`;
        } else {
          planName = agency.plan_name || 'No Plan';
        }
      }
      
      return {
        id: agency.id,
        name: agency.name,
        slug: agency.slug,
        created_at: agency.created_at,
        status: agency.subscription_status || 'none',
        current_period_end: agency.current_period_end,
        trial_ends_at: agency.trial_ends_at,
        plan_name: planName,
        price_monthly_cents: agency.display_price_cents || 0,
        stripe_subscription_id: agency.stripe_subscription_id,
        current_clients: agency.current_clients || 0,
        current_agents: agency.current_agents || 0,
        max_clients: agency.max_clients || 0,
        max_agents: agency.max_agents || 0,
      };
    }) || [];

    console.log("Sample formatted agency:", formatted[0]);

    return new Response(JSON.stringify({ data: formatted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in get-billing-data:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
