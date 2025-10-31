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

    // Get minimum plan price for dynamic pricing
    const { data: minPlanData } = await supabaseClient
      .from("subscription_plans")
      .select("price_monthly_cents")
      .eq("is_active", true)
      .order("price_monthly_cents", { ascending: true })
      .limit(1)
      .single();
    
    const minPlanPrice = minPlanData 
      ? `$${(minPlanData.price_monthly_cents / 100).toFixed(2)}`
      : "$99.00";

    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // Find trials ending in 3 days
    const { data: threeDayTrials } = await supabaseClient
      .from("agency_subscriptions")
      .select(`
        *,
        agencies(name, owner_id)
      `)
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", threeDaysFromNow.toISOString())
      .is("stripe_subscription_id", null);

    // Find trials ending in 1 day
    const { data: oneDayTrials } = await supabaseClient
      .from("agency_subscriptions")
      .select(`
        *,
        agencies(name, owner_id)
      `)
      .eq("status", "trialing")
      .gte("trial_ends_at", now.toISOString())
      .lte("trial_ends_at", oneDayFromNow.toISOString())
      .is("stripe_subscription_id", null);

    // Find trials that have ended without subscription
    const { data: endedTrials } = await supabaseClient
      .from("agency_subscriptions")
      .select(`
        *,
        agencies(name, owner_id)
      `)
      .eq("status", "trialing")
      .lt("trial_ends_at", now.toISOString())
      .is("stripe_subscription_id", null);

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
                trialEndDate: new Date(trial.trial_ends_at).toLocaleDateString(),
                minPlanPrice: minPlanPrice,
                subscriptionUrl: `${Deno.env.get("VITE_SUPABASE_URL") || "https://app.totaldash.com"}/agency/subscription`,
                supportEmail: "support@totaldash.com",
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
                trialEndDate: new Date(trial.trial_ends_at).toLocaleDateString(),
                minPlanPrice: minPlanPrice,
                subscriptionUrl: `${Deno.env.get("VITE_SUPABASE_URL") || "https://app.totaldash.com"}/agency/subscription`,
                supportEmail: "support@totaldash.com",
              },
            },
          });
          emailsSent++;
        }
      } catch (error) {
        console.error("Failed to send 1-day reminder:", error);
      }
    }

    // Send trial ended emails
    for (const trial of endedTrials || []) {
      try {
        const { data: owner } = await supabaseClient
          .from("profiles")
          .select("email")
          .eq("id", trial.agencies.owner_id)
          .single();

        if (owner?.email) {
          const trialEndDate = new Date(trial.trial_ends_at);
          const dataDeleteDate = new Date(trialEndDate);
          dataDeleteDate.setDate(dataDeleteDate.getDate() + 30);

          await supabaseClient.functions.invoke("send-email", {
            body: {
              templateKey: "trial_ended",
              recipientEmail: owner.email,
              variables: {
                userName: owner.email.split("@")[0],
                agencyName: trial.agencies.name,
                trialEndDate: trialEndDate.toLocaleDateString(),
                minPlanPrice: minPlanPrice,
                subscriptionUrl: `${Deno.env.get("VITE_SUPABASE_URL") || "https://app.totaldash.com"}/agency/subscription`,
                dataDeleteDate: dataDeleteDate.toLocaleDateString(),
                supportEmail: "support@totaldash.com",
              },
            },
          });
          emailsSent++;
        }
      } catch (error) {
        console.error("Failed to send trial ended email:", error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailsSent,
        threeDayTrials: threeDayTrials?.length || 0,
        oneDayTrials: oneDayTrials?.length || 0,
        endedTrials: endedTrials?.length || 0,
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
