import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) throw new Error('Unauthorized');

    const { action, agentId, documentId, fileData, fileName, fileType } = await req.json();

    // Fetch agent config to get Voiceflow API key
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('config')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) throw new Error('Agent not found');

    const voiceflowApiKey = agent.config?.voiceflow_api_key;
    if (!voiceflowApiKey) throw new Error('Voiceflow API key not configured');

    const voiceflowHeaders = {
      'Authorization': voiceflowApiKey,
    };

    // Handle different actions
    if (action === 'list') {
      // List all documents
      const response = await fetch('https://api.voiceflow.com/v1/knowledge-base/docs', {
        method: 'GET',
        headers: voiceflowHeaders,
      });

      const data = await response.json();
      
      return new Response(JSON.stringify({ documents: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upload') {
      // Upload a document
      const formData = new FormData();
      
      // Convert base64 to blob
      const base64Data = fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType });
      
      formData.append('file', blob, fileName);

      const response = await fetch('https://api.voiceflow.com/v1/knowledge-base/docs/upload', {
        method: 'POST',
        headers: {
          'Authorization': voiceflowApiKey,
        },
        body: formData,
      });

      const data = await response.json();
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      // Delete a document
      const response = await fetch(`https://api.voiceflow.com/v1/knowledge-base/docs/${documentId}`, {
        method: 'DELETE',
        headers: voiceflowHeaders,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
