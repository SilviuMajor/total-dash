import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;

    // Get user's agency
    const { data: agencyUser } = await supabaseClient
      .from("agency_users")
      .select("agency_id")
      .eq("user_id", userData.user.id)
      .single();

    if (!agencyUser) {
      throw new Error("User not associated with any agency");
    }

    // Get subscription
    const { data: subscription, error: subError } = await supabaseClient
      .from("agency_subscriptions")
      .select("*, agencies(name)")
      .eq("agency_id", agencyUser.agency_id)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.status !== "trialing") {
      throw new Error("Can only cancel subscriptions in trial period");
    }

    if (!subscription.stripe_subscription_id) {
      throw new Error("No Stripe subscription found");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Cancel Stripe subscription
    await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

    // Update database
    const { error: updateError } = await supabaseClient
      .from("agency_subscriptions")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
      })
      .eq("agency_id", agencyUser.agency_id);

    if (updateError) {
      console.error("Failed to update subscription:", updateError);
      throw updateError;
    }

    // Send cancellation email
    try {
      await supabaseClient.functions.invoke("send-email", {
        body: {
          templateKey: "subscription_canceled",
          recipientEmail: userData.user.email,
          variables: {
            userName: userData.user.email?.split("@")[0] || "there",
            agencyName: subscription.agencies?.name || "Your Agency",
            accessEndsDate: subscription.trial_ends_at
              ? new Date(subscription.trial_ends_at).toLocaleDateString()
              : "immediately",
            resubscribeUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
          },
        },
      });
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in cancel-trial-subscription:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
