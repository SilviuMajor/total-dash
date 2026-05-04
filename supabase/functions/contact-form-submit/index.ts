import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOTIFY_TO = "support@fiveleaf.co.uk";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const company = String(body.company ?? "").trim();
    const message = String(body.message ?? "").trim();

    if (!name || name.length > 200) {
      return new Response(JSON.stringify({ error: "Name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Valid email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!message || message.length < 5 || message.length > 5000) {
      return new Response(JSON.stringify({ error: "Message required (5–5000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (company.length > 200) {
      return new Response(JSON.stringify({ error: "Company too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";
    const ipHash = ip ? await hashIp(ip) : null;

    const { error: insertError } = await supabase
      .from("contact_submissions")
      .insert({
        name,
        email,
        company: company || null,
        message,
        user_agent: userAgent || null,
        ip_hash: ipHash,
      });

    if (insertError) {
      console.error("contact_submissions insert failed:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save submission" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#333;">New marketing site enquiry</h2>
            <div style="background:#f9f9f9;padding:15px;border-radius:5px;margin-bottom:15px;">
              <p style="margin:5px 0;"><strong>Name:</strong> ${escapeHtml(name)}</p>
              <p style="margin:5px 0;"><strong>Email:</strong> ${escapeHtml(email)}</p>
              <p style="margin:5px 0;"><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
            </div>
            <div style="background:#fff;padding:15px;border:1px solid #ddd;border-radius:5px;">
              <h3 style="color:#555;margin-top:0;">Message</h3>
              <p style="white-space:pre-wrap;">${escapeHtml(message)}</p>
            </div>
            <p style="color:#888;font-size:12px;margin-top:20px;">
              Submitted ${new Date().toISOString()} from total-dash.com
            </p>
          </div>
        `;
        await resend.emails.send({
          from: "Total Dash <noreply@totaldash.com>",
          to: [NOTIFY_TO],
          reply_to: email,
          subject: `New enquiry from ${name}${company ? ` (${company})` : ""}`,
          html,
        });
      } catch (mailError) {
        // Notification failure must not fail the request — the row is saved.
        console.error("contact-form-submit notification email failed:", mailError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured; skipping notification email");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("contact-form-submit error:", msg);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
