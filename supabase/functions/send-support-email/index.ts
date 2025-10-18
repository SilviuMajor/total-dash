import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      userEmail,
      userName,
      clientName,
      agentName,
      subject,
      description,
      priority,
      category,
    } = await req.json();

    // Get support email from agency_settings
    const { data: settings } = await supabase
      .from('agency_settings')
      .select('support_email')
      .single();

    const supportEmail = settings?.support_email;

    if (!supportEmail) {
      throw new Error('Support email not configured');
    }

    // Format category for display
    const categoryDisplay = category
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Support Request</h2>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 5px 0;"><strong>Priority:</strong> ${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}</p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${categoryDisplay}</p>
          <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
        </div>

        <div style="background-color: #fff; padding: 15px; border: 1px solid #ddd; border-radius: 5px; margin-bottom: 20px;">
          <h3 style="color: #555; margin-top: 0;">Description:</h3>
          <p style="white-space: pre-wrap;">${description}</p>
        </div>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
          <h3 style="color: #555; margin-top: 0;">Request Details:</h3>
          <p style="margin: 5px 0;"><strong>From:</strong> ${userName} (${userEmail})</p>
          <p style="margin: 5px 0;"><strong>Client:</strong> ${clientName}</p>
          <p style="margin: 5px 0;"><strong>Agent:</strong> ${agentName}</p>
          <p style="margin: 5px 0;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    const emailResponse = await resend.emails.send({
      from: "Support Request <onboarding@resend.dev>",
      to: [supportEmail],
      reply_to: userEmail,
      subject: `Support Request: ${subject}`,
      html: emailHtml,
    });

    console.log("Support email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-support-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
