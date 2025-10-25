import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-AGENCY-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planId } = await req.json();
    if (!planId) throw new Error("planId is required");
    logStep("Request data", { planId });

    // Get user's agency
    const { data: agencyUser, error: agencyUserError } = await supabaseClient
      .from("agency_users")
      .select("agency_id, agencies(id, name, owner_id)")
      .eq("user_id", user.id)
      .single();

    if (agencyUserError || !agencyUser) {
      throw new Error("User is not associated with an agency");
    }
    logStep("Agency found", { agencyId: agencyUser.agency_id });

    // Validate current usage against plan limits
    logStep("Checking current usage");
    const { count: clientsCount } = await supabaseClient
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyUser.agency_id)
      .is("deleted_at", null);

    const { count: agentsCount } = await supabaseClient
      .from("agents")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyUser.agency_id);

    const { count: teamCount } = await supabaseClient
      .from("agency_users")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agencyUser.agency_id);

    logStep("Current usage", { 
      clients: clientsCount, 
      agents: agentsCount, 
      team: teamCount 
    });

    // Get full plan details for validation
    const { data: fullPlan, error: fullPlanError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (fullPlanError || !fullPlan) {
      throw new Error("Invalid plan");
    }

    // Validate plan can accommodate current usage
    if (fullPlan.max_clients !== -1 && (clientsCount || 0) > fullPlan.max_clients) {
      throw new Error(`Selected plan cannot accommodate your current ${clientsCount} clients. Please contact support.`);
    }
    if (fullPlan.max_agents !== -1 && (agentsCount || 0) > fullPlan.max_agents) {
      throw new Error(`Selected plan cannot accommodate your current ${agentsCount} agents. Please contact support.`);
    }
    if (fullPlan.max_team_members !== -1 && (teamCount || 0) > fullPlan.max_team_members) {
      throw new Error(`Selected plan cannot accommodate your current ${teamCount} team members. Please contact support.`);
    }

    // Check for previous subscription (re-subscription scenario)
    const { data: previousSub } = await supabaseClient
      .from("agency_subscriptions")
      .select("snapshot_price_monthly_cents, custom_price_monthly_cents, is_custom_pricing")
      .eq("agency_id", agencyUser.agency_id)
      .single();

    if (previousSub) {
      // Get effective previous price
      const previousPrice = previousSub.is_custom_pricing && previousSub.custom_price_monthly_cents
        ? previousSub.custom_price_monthly_cents
        : previousSub.snapshot_price_monthly_cents;

      if (previousPrice && fullPlan.price_monthly_cents <= previousPrice) {
        throw new Error(`Selected plan must have a higher price than your previous plan ($${(previousPrice / 100).toFixed(2)}/mo).`);
      }
      
      logStep("Previous subscription check passed", { previousPrice, newPrice: fullPlan.price_monthly_cents });
    }

    if (!fullPlan.stripe_price_id) {
      throw new Error("Plan does not have a Stripe price ID configured");
    }
    logStep("Plan validated", { planId, stripePriceId: fullPlan.stripe_price_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    } else {
      logStep("No existing customer, will create during checkout");
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: fullPlan.stripe_price_id,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/agency/subscription?success=true`,
      cancel_url: `${origin}/agency/subscription?canceled=true`,
      metadata: {
        agency_id: agencyUser.agency_id,
        plan_id: planId,
        user_id: user.id,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
