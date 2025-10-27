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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Find trials ending in 3 days
    const { data: threeDayTrials } = await supabaseClient
      .from("agency_subscriptions")
      .select(`
        *,
        agencies(name, owner_id),
        subscription_plans(name, price_monthly_cents)
      `)
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", threeDaysFromNow.toISOString());

    // Find trials ending in 1 day
    const { data: oneDayTrials } = await supabaseClient
      .from("agency_subscriptions")
      .select(`
        *,
        agencies(name, owner_id),
        subscription_plans(name, price_monthly_cents)
      `)
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", oneDayFromNow.toISOString());

    let emailsSent = 0;

    // Send 3-day reminders
    for (const trial of threeDayTrials || []) {
      try {
        const { data: owner } = await supabaseClient
          .from("profiles")
          .select("email")
          .eq("id", trial.agencies.owner_id)
          .single();

        if (owner?.email) {
          await supabaseClient.functions.invoke("send-email", {
            body: {
              templateKey: "trial_ending_3days",
              recipientEmail: owner.email,
              variables: {
                userName: owner.email.split("@")[0],
                agencyName: trial.agencies.name,
                daysRemaining: "3",
                trialEndDate: new Date(trial.trial_ends_at).toLocaleDateString(),
                planName: trial.subscription_plans.name,
                monthlyPrice: `$${(trial.subscription_plans.price_monthly_cents / 100).toFixed(2)}`,
                manageSubscriptionUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                cancelUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                supportEmail: "support@yourplatform.com",
              },
            },
          });
          emailsSent++;
        }
      } catch (error) {
        console.error("Failed to send 3-day reminder:", error);
      }
    }

    // Send 1-day reminders
    for (const trial of oneDayTrials || []) {
      try {
        const { data: owner } = await supabaseClient
          .from("profiles")
          .select("email")
          .eq("id", trial.agencies.owner_id)
          .single();

        if (owner?.email) {
          await supabaseClient.functions.invoke("send-email", {
            body: {
              templateKey: "trial_ending_1day",
              recipientEmail: owner.email,
              variables: {
                userName: owner.email.split("@")[0],
                agencyName: trial.agencies.name,
                planName: trial.subscription_plans.name,
                monthlyPrice: `$${(trial.subscription_plans.price_monthly_cents / 100).toFixed(2)}`,
                cancelUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
              },
            },
          });
          emailsSent++;
        }
      } catch (error) {
        console.error("Failed to send 1-day reminder:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        threeDayTrials: threeDayTrials?.length || 0,
        oneDayTrials: oneDayTrials?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in schedule-trial-reminder-emails:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
