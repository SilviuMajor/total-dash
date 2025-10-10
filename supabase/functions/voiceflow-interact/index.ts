import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, userId, message, action, conversationId, isTestMode } = await req.json();

    console.log('Voiceflow interact request:', { agentId, userId, action, isTestMode });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch agent details
    const { data: agent, error: agentError } = await supabaseClient
      .from('agents')
      .select('config')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      console.error('Agent fetch error:', agentError);
      throw new Error('Agent not found');
    }

    const apiKey = agent.config?.api_key;
    const projectId = agent.config?.project_id;

    if (!apiKey || !projectId) {
      throw new Error('Agent missing Voiceflow credentials');
    }

    // Build Voiceflow request based on action type
    let voiceflowRequestBody: any;

    if (action === 'launch') {
      // Launch action - starts conversation with Voiceflow's opening message
      voiceflowRequestBody = {
        action: {
          type: 'launch'
        },
        config: {
          tts: false,
          stripSSML: true,
        }
      };
      console.log('Sending launch request to Voiceflow');
    } else {
      // Text action - normal user message
      voiceflowRequestBody = {
        action: {
          type: 'text',
          payload: message,
        },
        config: {
          tts: false,
          stripSSML: true,
        }
      };
      console.log('Sending text message to Voiceflow:', message);
    }

    // Call Voiceflow Interact API
    const voiceflowResponse = await fetch(
      `https://general-runtime.voiceflow.com/state/user/${userId}/interact`,
      {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voiceflowRequestBody),
      }
    );

    if (!voiceflowResponse.ok) {
      const errorText = await voiceflowResponse.text();
      console.error('Voiceflow API error:', errorText);
      throw new Error('Voiceflow API request failed');
    }

    const voiceflowData = await voiceflowResponse.json();
    console.log('Voiceflow response:', voiceflowData);

    // Extract bot messages AND buttons from response
    interface BotResponse {
      type: 'text' | 'buttons';
      text?: string;
      buttons?: Array<{ text: string; payload: any }>;
    }

    const botResponses: BotResponse[] = [];
    if (Array.isArray(voiceflowData)) {
      voiceflowData.forEach((item: any) => {
        if (item.type === 'text' && item.payload?.message) {
          botResponses.push({
            type: 'text',
            text: item.payload.message
          });
        } else if (item.type === 'choice' && item.payload?.buttons) {
          // Voiceflow sends buttons as "choice" type
          botResponses.push({
            type: 'buttons',
            buttons: item.payload.buttons.map((btn: any) => ({
              text: btn.name || btn.label,
              payload: btn.request || btn.payload
            }))
          });
        }
      });
    }

    // Create or update conversation
    let currentConversationId = conversationId;

    if (!currentConversationId) {
      const { data: newConv, error: convError } = await supabaseClient
        .from('conversations')
        .insert({
          agent_id: agentId,
          caller_phone: userId,
          status: 'active',
          is_widget_test: isTestMode,
          metadata: { source: 'widget_test' },
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Conversation creation error:', convError);
        throw convError;
      }

      currentConversationId = newConv.id;
    }

    // Only insert user transcript for text messages, not launch
    if (action !== 'launch' && message) {
      const { error: userTranscriptError } = await supabaseClient
        .from('transcripts')
        .insert({
          conversation_id: currentConversationId,
          speaker: 'user',
          text: message,
          timestamp: new Date().toISOString(),
        });

      if (userTranscriptError) {
        console.error('User transcript error:', userTranscriptError);
      }
    }

    // Insert bot response transcripts
    for (const response of botResponses) {
      if (response.type === 'text' && response.text) {
        const { error: botTranscriptError } = await supabaseClient
          .from('transcripts')
          .insert({
            conversation_id: currentConversationId,
            speaker: 'assistant',
            text: response.text,
            timestamp: new Date().toISOString(),
          });

        if (botTranscriptError) {
          console.error('Bot transcript error:', botTranscriptError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        conversationId: currentConversationId,
        botResponses,
        userId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in voiceflow-interact:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
