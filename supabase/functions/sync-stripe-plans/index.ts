import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-PLANS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);

    const { data: isSuperAdmin } = await supabaseClient
      .rpc("is_super_admin", { _user_id: userData.user.id });

    if (!isSuperAdmin) {
      throw new Error("Unauthorized: Super admin access required");
    }

    logStep("Super admin verified");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch all active recurring prices from Stripe
    const prices = await stripe.prices.list({
      active: true,
      type: "recurring",
      expand: ["data.product"],
    });

    logStep("Fetched Stripe prices", { count: prices.data.length });

    let synced = 0;
    let updated = 0;
    let newPlans = 0;

    for (const price of prices.data) {
      if (price.recurring?.interval !== "month") continue;

      const product = price.product as Stripe.Product;
      
      // Check if plan exists
      const { data: existingPlan } = await supabaseClient
        .from("subscription_plans")
        .select("id")
        .eq("stripe_price_id", price.id)
        .single();

      const planData = {
        stripe_price_id: price.id,
        name: product.name,
        description: product.description || null,
        price_monthly_cents: price.unit_amount || 0,
        max_clients: -1, // Default to unlimited
        max_agents: -1,
        max_team_members: -1,
        has_whitelabel_access: false,
        has_support_access: false,
        extras: [],
        is_active: true,
      };

      if (existingPlan) {
        // Update existing plan
        const { error } = await supabaseClient
          .from("subscription_plans")
          .update({
            name: planData.name,
            description: planData.description,
            price_monthly_cents: planData.price_monthly_cents,
          })
          .eq("id", existingPlan.id);

        if (!error) updated++;
      } else {
        // Insert new plan
        const { error } = await supabaseClient
          .from("subscription_plans")
          .insert(planData);

        if (!error) newPlans++;
      }

      synced++;
    }

    logStep("Sync completed", { synced, updated, newPlans });

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced, 
        updated, 
        new: newPlans 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
