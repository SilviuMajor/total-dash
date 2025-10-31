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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify super admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const user = userData.user;

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { data: isSuperAdmin } = await supabaseAdmin
      .from("super_admin_users")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Use database function to get agencies with subscription data
    const { data: agencies, error } = await supabaseAdmin
      .rpc('get_agencies_overview_data');

    if (error) {
      console.error("Database error:", error);
      throw error;
    }

    // Format the response
    const formattedAgencies = (agencies || []).map((agency: any) => ({
      id: agency.id,
      name: agency.name,
      slug: agency.slug,
      logo_light_url: agency.logo_light_url,
      logo_dark_url: agency.logo_dark_url,
      full_logo_light_url: agency.full_logo_light_url,
      full_logo_dark_url: agency.full_logo_dark_url,
      support_email: agency.support_email,
      is_active: agency.is_active,
      created_at: agency.created_at,
      trial_ends_at: agency.trial_ends_at,
      owner_id: agency.owner_id,
      subscription: {
        status: agency.subscription_status,
        current_clients: agency.current_clients || 0,
        current_agents: agency.current_agents || 0,
        current_team_members: agency.current_team_members || 1,
        plan: {
          name: agency.is_custom_pricing 
            ? `${agency.plan_name} (Custom)` 
            : (agency.plan_name || 'No Plan'),
          price_cents: agency.display_price_cents || 0
        }
      }
    }));

    return new Response(JSON.stringify({ agencies: formattedAgencies }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in get-agencies-overview:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
