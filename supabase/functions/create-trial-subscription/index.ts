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

    // Calculate trial end date (no Stripe needed for trials)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trial_duration_days);

    // Store trial subscription in database (Stripe IDs will be added later when they subscribe)
    const { error: upsertError } = await supabaseClient
      .from("agency_subscriptions")
      .upsert({
        agency_id: agencyId,
        plan_id: plan.id,
        stripe_subscription_id: null, // Will be set when they subscribe after trial
        stripe_customer_id: null,     // Will be set when they subscribe after trial
        status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: trialEndsAt.toISOString(),
        snapshot_plan_name: plan.name,
        snapshot_price_monthly_cents: plan.price_monthly_cents,
        snapshot_max_clients: plan.max_clients,
        snapshot_max_agents: plan.max_agents,
        snapshot_max_team_members: plan.max_team_members,
        snapshot_extras: plan.extras,
        snapshot_created_at: new Date().toISOString(),
        current_clients: 0,
        current_agents: 0,
        current_team_members: 1, // The owner
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
        trialEndsAt: trialEndsAt.toISOString(),
        message: "Trial subscription created successfully",
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
