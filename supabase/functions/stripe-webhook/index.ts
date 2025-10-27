import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No stripe-signature header");
    }

    const body = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified", { type: event.type });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logStep("Webhook signature verification failed", { error: errorMsg });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          subscriptionId: session.subscription 
        });

        const agencyId = session.metadata?.agency_id;
        const planId = session.metadata?.plan_id;

        if (!agencyId || !planId) {
          logStep("Missing metadata", { agencyId, planId });
          break;
        }

        // Fetch plan details from subscription_plans
        const { data: plan, error: planError } = await supabaseClient
          .from("subscription_plans")
          .select("*")
          .eq("id", planId)
          .single();

        if (planError || !plan) {
          logStep("Error fetching plan", { error: planError });
          throw new Error("Plan not found");
        }

        // Fetch Stripe subscription details for accurate period dates
        const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription as string);

        // Check for previous subscription (re-subscription scenario)
        const { data: existingSub } = await supabaseClient
          .from("agency_subscriptions")
          .select("id")
          .eq("agency_id", agencyId)
          .single();

        // Create snapshot from current plan values
        const subscriptionData: any = {
          agency_id: agencyId,
          plan_id: planId,
          status: "active",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          snapshot_plan_name: plan.name,
          snapshot_price_monthly_cents: plan.price_monthly_cents,
          snapshot_max_clients: plan.max_clients,
          snapshot_max_agents: plan.max_agents,
          snapshot_max_team_members: plan.max_team_members,
          snapshot_extras: plan.extras || [],
          snapshot_created_at: new Date().toISOString(),
        };

        // If re-subscription, link to previous subscription
        if (existingSub) {
          subscriptionData.previous_subscription_id = existingSub.id;
          subscriptionData.resubscribed_at = new Date().toISOString();
        }

        // Update or create agency subscription
        const { error: upsertError } = await supabaseClient
          .from("agency_subscriptions")
          .upsert(subscriptionData, {
            onConflict: "agency_id"
          });

        if (upsertError) {
          logStep("Error updating subscription", { error: upsertError });
          throw upsertError;
        }

        logStep("Subscription activated with snapshot", { snapshot: subscriptionData });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const previousAttributes = (event.data as any).previous_attributes;
        
        logStep("Subscription updated", { 
          subscriptionId: subscription.id,
          status: subscription.status,
          previousStatus: previousAttributes?.status
        });

        const updateData: any = {
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        };

        // If payment succeeds after past_due, clear grace period
        if (subscription.status === 'active') {
          updateData.grace_period_ends_at = null;
          
          // If converting from trial to active, clear trial_ends_at and send email
          if (previousAttributes?.status === 'trialing') {
            updateData.trial_ends_at = null;
            
            // Get agency details for email
            const { data: agencySub } = await supabaseClient
              .from("agency_subscriptions")
              .select("agencies(name, owner_id), subscription_plans(name, price_monthly_cents)")
              .eq("stripe_subscription_id", subscription.id)
              .single();
              
            if (agencySub) {
              try {
                const { data: owner } = await supabaseClient
                  .from("profiles")
                  .select("email")
                  .eq("id", (agencySub.agencies as any).owner_id)
                  .single();
                  
                if (owner?.email) {
                  await supabaseClient.functions.invoke("send-email", {
                    body: {
                      templateKey: "trial_converted",
                      recipientEmail: owner.email,
                      variables: {
                        userName: owner.email.split("@")[0],
                        planName: (agencySub.subscription_plans as any).name,
                        monthlyPrice: `$${((agencySub.subscription_plans as any).price_monthly_cents / 100).toFixed(2)}`,
                        nextBillingDate: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
                        invoiceUrl: subscription.latest_invoice ? `https://dashboard.stripe.com/invoices/${subscription.latest_invoice}` : "#",
                        maxClients: "unlimited",
                        maxAgents: "unlimited",
                        maxTeamMembers: "unlimited",
                        dashboardUrl: `${Deno.env.get("SUPABASE_URL")}/agency`,
                        manageSubscriptionUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                      },
                    },
                  });
                }
              } catch (emailError) {
                console.error("Failed to send conversion email:", emailError);
              }
            }
          }
        }

        const { error: updateError } = await supabaseClient
          .from("agency_subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id);

        if (updateError) {
          logStep("Error updating subscription", { error: updateError });
          throw updateError;
        }

        logStep("Subscription status updated successfully");
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Trial will end", { subscriptionId: subscription.id, trialEnd: subscription.trial_end });

        // Get agency details for email
        const { data: agencySub } = await supabaseClient
          .from("agency_subscriptions")
          .select("agencies(name, owner_id), subscription_plans(name, price_monthly_cents)")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (agencySub) {
          try {
            const { data: owner } = await supabaseClient
              .from("profiles")
              .select("email")
              .eq("id", (agencySub.agencies as any).owner_id)
              .single();
              
            if (owner?.email && subscription.trial_end) {
              const daysRemaining = Math.ceil((subscription.trial_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
              
              await supabaseClient.functions.invoke("send-email", {
                body: {
                  templateKey: daysRemaining <= 1 ? "trial_ending_1day" : "trial_ending_3days",
                  recipientEmail: owner.email,
                  variables: {
                    userName: owner.email.split("@")[0],
                    agencyName: (agencySub.agencies as any).name,
                    daysRemaining: String(daysRemaining),
                    trialEndDate: new Date(subscription.trial_end * 1000).toLocaleDateString(),
                    planName: (agencySub.subscription_plans as any).name,
                    monthlyPrice: `$${((agencySub.subscription_plans as any).price_monthly_cents / 100).toFixed(2)}`,
                    manageSubscriptionUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                    cancelUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                    supportEmail: "support@yourplatform.com",
                  },
                },
              });
            }
          } catch (emailError) {
            console.error("Failed to send trial ending email:", emailError);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { subscriptionId: subscription.id });

        const { error: deleteError } = await supabaseClient
          .from("agency_subscriptions")
          .update({ 
            status: "canceled",
            canceled_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        if (deleteError) {
          logStep("Error canceling subscription", { error: deleteError });
          throw deleteError;
        }

        // Send cancellation email
        const { data: agencySub } = await supabaseClient
          .from("agency_subscriptions")
          .select("agencies(name, owner_id), trial_ends_at, current_period_end")
          .eq("stripe_subscription_id", subscription.id)
          .single();

        if (agencySub) {
          try {
            const { data: owner } = await supabaseClient
              .from("profiles")
              .select("email")
              .eq("id", (agencySub.agencies as any).owner_id)
              .single();
              
            if (owner?.email) {
              await supabaseClient.functions.invoke("send-email", {
                body: {
                  templateKey: "subscription_canceled",
                  recipientEmail: owner.email,
                  variables: {
                    userName: owner.email.split("@")[0],
                    agencyName: (agencySub.agencies as any).name,
                    accessEndsDate: agencySub.current_period_end 
                      ? new Date(agencySub.current_period_end).toLocaleDateString()
                      : "immediately",
                    resubscribeUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                  },
                },
              });
            }
          } catch (emailError) {
            console.error("Failed to send cancellation email:", emailError);
          }
        }

        logStep("Subscription canceled successfully");
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { 
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription 
        });

        if (invoice.subscription) {
          // Set 3-day grace period
          const gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
          
          const { error: failError } = await supabaseClient
            .from("agency_subscriptions")
            .update({ 
              status: "past_due",
              grace_period_ends_at: gracePeriodEnd
            })
            .eq("stripe_subscription_id", invoice.subscription as string);

          if (failError) {
            logStep("Error updating subscription to past_due", { error: failError });
            throw failError;
          }

          // Send payment failed email
          const { data: agencySub } = await supabaseClient
            .from("agency_subscriptions")
            .select("agencies(name, owner_id)")
            .eq("stripe_subscription_id", invoice.subscription as string)
            .single();

          if (agencySub) {
            try {
              const { data: owner } = await supabaseClient
                .from("profiles")
                .select("email")
                .eq("id", (agencySub.agencies as any).owner_id)
                .single();
                
              if (owner?.email) {
                await supabaseClient.functions.invoke("send-email", {
                  body: {
                    templateKey: "payment_failed",
                    recipientEmail: owner.email,
                    variables: {
                      userName: owner.email.split("@")[0],
                      agencyName: (agencySub.agencies as any).name,
                      gracePeriodDays: "3",
                      updatePaymentUrl: `${Deno.env.get("SUPABASE_URL")}/agency/subscription`,
                    },
                  },
                });
              }
            } catch (emailError) {
              console.error("Failed to send payment failed email:", emailError);
            }
          }

          logStep("Subscription marked as past_due with grace period", { gracePeriodEnd });
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
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
