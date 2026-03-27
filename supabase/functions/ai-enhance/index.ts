import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, mode } = await req.json();

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "No message provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    let systemPrompt = "";
    switch (mode) {
      case "improve":
        systemPrompt = "You are a writing assistant for customer service agents. Rewrite the following message to fix any grammar or spelling errors and make it sound more professional. Keep the same meaning and intent. Keep it natural — not overly formal. Reply with ONLY the improved message, nothing else.";
        break;
      case "concise":
        systemPrompt = "You are a writing assistant for customer service agents. Rewrite the following message to be shorter and more concise while keeping the same meaning. Remove unnecessary words. Reply with ONLY the concise message, nothing else.";
        break;
      case "friendly":
        systemPrompt = "You are a writing assistant for customer service agents. Rewrite the following message to sound warmer and more friendly while keeping the same meaning. Add a human touch. Reply with ONLY the friendly message, nothing else.";
        break;
      default:
        systemPrompt = "You are a writing assistant. Improve the following message. Reply with ONLY the improved message, nothing else.";
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }

      return new Response(JSON.stringify({ error: "AI service error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const data = await response.json();
    const enhanced = data.choices?.[0]?.message?.content || message;

    return new Response(JSON.stringify({ enhanced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in ai-enhance:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
