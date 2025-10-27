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
    const { agencyId, userEmail } = await req.json();

    if (!agencyId || !userEmail) {
      throw new Error("Missing agencyId or userEmail");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get Starter plan
    const { data: plan, error: planError } = await supabaseClient
      .from("subscription_plans")
      .select("*")
      .eq("name", "Starter")
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      throw new Error("Starter plan not found");
    }

    // Check if plan has trial duration
    if (!plan.trial_duration_days || plan.trial_duration_days === 0) {
      console.log("Plan has no trial period, skipping Stripe setup");
      return new Response(
        JSON.stringify({ success: true, skipStripe: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!plan.stripe_price_id) {
      throw new Error("Plan has no Stripe price ID configured");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Create or find Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: userEmail,
        metadata: { agency_id: agencyId },
      });
    }

    // Create Stripe subscription with trial
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripe_price_id }],
      trial_period_days: plan.trial_duration_days,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent"],
    });

    const trialEndsAt = new Date(subscription.trial_end! * 1000);

    // Store in agency_subscriptions
    const { error: upsertError } = await supabaseClient
      .from("agency_subscriptions")
      .upsert({
        agency_id: agencyId,
        plan_id: plan.id,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customer.id,
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        snapshot_plan_name: plan.name,
        snapshot_price_monthly_cents: plan.price_monthly_cents,
        snapshot_max_clients: plan.max_clients,
        snapshot_max_agents: plan.max_agents,
        snapshot_max_team_members: plan.max_team_members,
        snapshot_extras: plan.extras,
        snapshot_created_at: new Date().toISOString(),
      }, {
        onConflict: "agency_id"
      });

    if (upsertError) {
      console.error("Failed to save subscription:", upsertError);
      throw upsertError;
    }

    // Get agency name for email
    const { data: agency } = await supabaseClient
      .from("agencies")
      .select("name")
      .eq("id", agencyId)
      .single();

    // Send welcome email
    try {
      await supabaseClient.functions.invoke("send-email", {
        body: {
          templateKey: "trial_welcome",
          recipientEmail: userEmail,
          variables: {
            userName: userEmail.split("@")[0],
            agencyName: agency?.name || "Your Agency",
            trialEndDate: trialEndsAt.toLocaleDateString(),
            planName: plan.name,
            monthlyPrice: `$${(plan.price_monthly_cents / 100).toFixed(2)}`,
            loginUrl: `${Deno.env.get("SUPABASE_URL")}/agency/login`,
          },
        },
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the whole operation if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriptionId: subscription.id,
        trialEndsAt: trialEndsAt.toISOString(),
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in create-trial-subscription:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
