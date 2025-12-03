import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Check authorization - allow both JWT auth and service role calls
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if this is a service role call (from other edge functions)
    const isServiceRoleCall = authHeader === `Bearer ${supabaseServiceKey}`;
    
    if (!isServiceRoleCall) {
      // Validate user JWT token
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        console.error("Invalid user token:", authError?.message);
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Email request from authenticated user:", user.id);
    } else {
      console.log("Email request from internal service call");
    }

    const { templateKey, recipientEmail, variables } = await req.json();

    if (!templateKey || !recipientEmail) {
      throw new Error("Missing templateKey or recipientEmail");
    }

    // Fetch email template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("Template not found:", templateKey);
      throw new Error(`Email template not found: ${templateKey}`);
    }

    // Replace variables in subject and content
    let subject = template.subject;
    let htmlContent = template.html_content;

    for (const [key, value] of Object.entries(variables || {})) {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, String(value));
      htmlContent = htmlContent.replace(regex, String(value));
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);

    const { data, error } = await resend.emails.send({
      from: "Total Dash <noreply@totaldash.com>",
      to: recipientEmail,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw error;
    }

    console.log("Email sent successfully:", data);

    // Log the email send to database
    try {
      await supabaseAdmin.from('email_send_log').insert({
        template_key: templateKey,
        recipient_email: recipientEmail,
        subject: subject,
        variables_used: variables,
        resend_message_id: data?.id,
        delivery_status: 'sent'
      });
    } catch (logError) {
      console.error("Failed to log email send:", logError);
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
