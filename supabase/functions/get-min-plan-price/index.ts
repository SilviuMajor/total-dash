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

    // Get the minimum plan price
    const { data: plans, error } = await supabaseClient
      .from("subscription_plans")
      .select("price_monthly_cents, name")
      .eq("is_active", true)
      .order("price_monthly_cents", { ascending: true })
      .limit(1)
      .single();

    if (error) throw error;

    const minPrice = plans.price_monthly_cents / 100;
    const formattedPrice = `$${minPrice.toFixed(2)}`;

    return new Response(
      JSON.stringify({ 
        price_cents: plans.price_monthly_cents,
        price_formatted: formattedPrice,
        plan_name: plans.name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error getting min plan price:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
