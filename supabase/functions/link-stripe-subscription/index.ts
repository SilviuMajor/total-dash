import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[LINK-STRIPE-SUBSCRIPTION] ${step}${detailsStr}`);
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

    const { agency_id, stripe_subscription_id } = await req.json();

    if (!agency_id || !stripe_subscription_id) {
      throw new Error("Missing required fields: agency_id and stripe_subscription_id");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(stripe_subscription_id, {
      expand: ["items.data.price.product"],
    });

    logStep("Fetched Stripe subscription", { subscriptionId: subscription.id });

    const price = subscription.items.data[0].price;
    const product = price.product as Stripe.Product;

    // Create snapshot from Stripe data
    const subscriptionData = {
      agency_id,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      snapshot_plan_name: product.name,
      snapshot_price_monthly_cents: price.unit_amount || 0,
      snapshot_max_clients: -1, // Default to unlimited for custom plans
      snapshot_max_agents: -1,
      snapshot_max_team_members: -1,
      snapshot_extras: [],
      snapshot_created_at: new Date().toISOString(),
      is_custom_pricing: true,
    };

    // Upsert subscription
    const { error: upsertError } = await supabaseClient
      .from("agency_subscriptions")
      .upsert(subscriptionData, { onConflict: "agency_id" });

    if (upsertError) {
      logStep("Error linking subscription", { error: upsertError });
      throw upsertError;
    }

    logStep("Subscription linked successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        subscription: subscriptionData
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
