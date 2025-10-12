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
    } else if (action === 'button') {
      // Button action - send button request payload directly
      try {
        const buttonPayload = JSON.parse(message);
        voiceflowRequestBody = {
          action: buttonPayload,
          config: {
            tts: false,
            stripSSML: true,
          }
        };
        console.log('Sending button action to Voiceflow:', buttonPayload);
      } catch (error) {
        console.error('Failed to parse button payload:', error);
        throw new Error('Invalid button payload');
      }
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

    // Fetch current state to get variables
    let voiceflowVariables: Record<string, any> = {};
    try {
      const stateResponse = await fetch(
        `https://general-runtime.voiceflow.com/state/user/${userId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': apiKey,
          },
        }
      );
      
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        voiceflowVariables = stateData?.variables || {};
        console.log('Extracted Voiceflow variables:', voiceflowVariables);
      }
    } catch (stateError) {
      console.error('Error fetching Voiceflow state:', stateError);
    }

    // Parse Voiceflow response
    const botResponses: any[] = [];
    
    if (voiceflowData && Array.isArray(voiceflowData)) {
      
      for (const item of voiceflowData) {
        if (item.type === 'text' && item.payload?.message) {
          botResponses.push({
            type: 'text',
            text: item.payload.message
          });
        } else if (item.type === 'choice' && item.payload?.buttons) {
          botResponses.push({
            type: 'choice',
            buttons: item.payload.buttons.map((btn: any) => ({
              text: btn.name,
              payload: btn.request
            }))
          });
        }
      }
    }

    // Create or get conversation
    let currentConversationId = conversationId;
    
    if (!currentConversationId) {
      // Create new conversation
      const { data: newConversation, error: convError } = await supabaseClient
        .from('conversations')
        .insert({
          agent_id: agentId,
          caller_phone: userId,
          status: 'active',
          is_widget_test: isTestMode,
          metadata: { 
            source: isTestMode ? 'widget_test' : 'widget',
            variables: {}
          }
        })
        .select()
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      currentConversationId = newConversation.id;
    }

    // Update conversation with captured variables
    if (currentConversationId && Object.keys(voiceflowVariables).length > 0) {
      const { error: updateError } = await supabaseClient
        .from('conversations')
        .update({
          metadata: {
            source: isTestMode ? 'widget_test' : 'widget',
            variables: voiceflowVariables,
            last_updated: new Date().toISOString()
          }
        })
        .eq('id', currentConversationId);
      
      if (updateError) {
        console.error('Error updating conversation metadata:', updateError);
      }
    }

    // Store user message in transcripts
    if (action === 'text' || action === 'button') {
      const userMessageText = action === 'button' 
        ? JSON.parse(message).payload?.label || 'Button clicked'
        : message;
      
      const { error: userTranscriptError } = await supabaseClient
        .from('transcripts')
        .insert({
          conversation_id: currentConversationId,
          speaker: 'user',
          text: userMessageText,
          metadata: action === 'button' ? {
            button_click: true,
            payload: JSON.parse(message),
            timestamp: new Date().toISOString()
          } : {}
        });

      if (userTranscriptError) {
        console.error('Error inserting user transcript:', userTranscriptError);
      }
    }

    // Store bot responses in transcripts with buttons and full trace
    for (const response of botResponses) {
      const { error: botTranscriptError } = await supabaseClient
        .from('transcripts')
        .insert({
          conversation_id: currentConversationId,
          speaker: 'assistant',
          text: response.text || null,
          buttons: response.buttons || null,
          metadata: {
            response_type: response.type,
            timestamp: new Date().toISOString(),
            full_trace: voiceflowData
          }
        });

      if (botTranscriptError) {
        console.error('Error inserting bot transcript:', botTranscriptError);
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
