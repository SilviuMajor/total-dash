import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-AGENCY-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get user's agency
    const { data: agencyUser, error: agencyUserError } = await supabaseClient
      .from("agency_users")
      .select("agency_id")
      .eq("user_id", user.id)
      .single();

    if (agencyUserError || !agencyUser) {
      logStep("User not associated with agency");
      return new Response(JSON.stringify({ 
        subscribed: false,
        status: null,
        plan_id: null,
        trial_ends_at: null,
        current_period_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Agency found", { agencyId: agencyUser.agency_id });

    // Get subscription from database
    const { data: subscription, error: subError } = await supabaseClient
      .from("agency_subscriptions")
      .select("*")
      .eq("agency_id", agencyUser.agency_id)
      .single();

    if (subError || !subscription) {
      logStep("No subscription found in database");
      return new Response(JSON.stringify({ 
        subscribed: false,
        status: null,
        plan_id: null,
        trial_ends_at: null,
        current_period_end: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Subscription found", { 
      status: subscription.status,
      planId: subscription.plan_id 
    });

    // If we have a Stripe subscription ID, verify with Stripe
    if (subscription.stripe_subscription_id) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        logStep("Stripe subscription retrieved", { 
          status: stripeSubscription.status,
          currentPeriodEnd: stripeSubscription.current_period_end 
        });

        // Update local database if status differs
        if (stripeSubscription.status !== subscription.status) {
          logStep("Syncing status from Stripe", { 
            oldStatus: subscription.status,
            newStatus: stripeSubscription.status 
          });
          
          await supabaseClient
            .from("agency_subscriptions")
            .update({
              status: stripeSubscription.status,
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            })
            .eq("agency_id", agencyUser.agency_id);

          subscription.status = stripeSubscription.status;
          subscription.current_period_end = new Date(stripeSubscription.current_period_end * 1000).toISOString();
        }
      } catch (stripeError) {
        const errorMsg = stripeError instanceof Error ? stripeError.message : String(stripeError);
        logStep("Error retrieving Stripe subscription", { error: errorMsg });
        // Continue with database data
      }
    }

    const isActive = subscription.status === "active" || subscription.status === "trialing";

    return new Response(JSON.stringify({
      subscribed: isActive,
      status: subscription.status,
      plan_id: subscription.plan_id,
      trial_ends_at: subscription.trial_ends_at,
      current_period_end: subscription.current_period_end
    }), {
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
