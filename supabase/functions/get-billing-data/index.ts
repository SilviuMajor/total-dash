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

    // Fetch all agencies with their subscriptions (no RLS restrictions)
    const { data: agencies, error } = await supabaseAdmin
      .from('agencies')
      .select(`
        id,
        name,
        logo_url,
        created_at,
        agency_subscriptions (
          status,
          current_period_end,
          trial_ends_at,
          created_at,
          stripe_subscription_id,
          snapshot_plan_name,
          custom_price_monthly_cents,
          snapshot_price_monthly_cents,
          is_custom_pricing,
          subscription_plans (
            name,
            price_monthly_cents
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Database query error:", error);
      throw error;
    }

    console.log(`Fetched ${agencies?.length || 0} agencies`);

    // Format the data
    const formatted = agencies?.map((agency: any) => {
      const sub = agency.agency_subscriptions?.[0];
      
      // Determine price based on custom pricing or snapshot/plan
      const price = sub?.is_custom_pricing 
        ? sub.custom_price_monthly_cents 
        : (sub?.snapshot_price_monthly_cents || sub?.subscription_plans?.price_monthly_cents || 0);
      
      // Determine plan name with custom indicator
      let planName = 'No Plan';
      if (sub) {
        if (sub.is_custom_pricing) {
          planName = `${sub.snapshot_plan_name || 'Custom Plan'} (Custom)`;
        } else {
          planName = sub.snapshot_plan_name || sub.subscription_plans?.name || 'No Plan';
        }
      }
      
      return {
        id: agency.id,
        name: agency.name,
        logo_url: agency.logo_url,
        created_at: agency.created_at,
        status: sub?.status || 'none',
        current_period_end: sub?.current_period_end,
        trial_ends_at: sub?.trial_ends_at,
        subscription_created_at: sub?.created_at,
        plan_name: planName,
        price_monthly_cents: price,
        stripe_subscription_id: sub?.stripe_subscription_id,
      };
    }) || [];

    console.log("Sample formatted agency:", formatted[0]);

    return new Response(JSON.stringify({ data: formatted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-billing-data:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
