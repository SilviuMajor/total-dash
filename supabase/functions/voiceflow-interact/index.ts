import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to create a transcript for a conversation
async function createTranscriptForConversation(
  supabaseClient: any,
  conversation: {
    id: string;
    agent_id: string;
    started_at: string;
    ended_at: string | null;
    metadata: Record<string, any>;
  }
) {
  console.log('Creating transcript for conversation:', conversation.id);
  
  // Fetch all messages for this conversation
  const { data: messages, error: messagesError } = await supabaseClient
    .from('transcripts')
    .select('speaker, text, timestamp, buttons, metadata')
    .eq('conversation_id', conversation.id)
    .order('timestamp', { ascending: true });

  if (messagesError) {
    console.error('Error fetching messages for transcript:', messagesError);
    throw messagesError;
  }

  // Calculate duration
  let duration = null;
  if (conversation.ended_at && conversation.started_at) {
    const start = new Date(conversation.started_at).getTime();
    const end = new Date(conversation.ended_at).getTime();
    duration = Math.floor((end - start) / 1000);
  }

  // Extract variables from metadata
  const variables = conversation.metadata?.variables || {};
  const userName = variables.user_name || null;
  const userEmail = variables.user_email || null;
  const userPhone = variables.user_phone || null;

  // Create the transcript
  const { error: insertError } = await supabaseClient
    .from('text_transcripts')
    .insert({
      source_conversation_id: conversation.id,
      agent_id: conversation.agent_id,
      user_name: userName,
      user_email: userEmail,
      user_phone: userPhone,
      conversation_started_at: conversation.started_at,
      conversation_ended_at: conversation.ended_at,
      duration,
      message_count: messages?.length || 0,
      captured_variables: variables,
      messages: messages || [],
    });

  if (insertError) {
    console.error('Error creating transcript:', insertError);
    throw insertError;
  }

  console.log('Transcript created successfully for conversation:', conversation.id);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agentId, userId, message, action, conversationId, isTestMode } = await req.json();

    console.log('Voiceflow interact request:', { agentId, userId, action, isTestMode });

    // Use service role key for all requests (supports both authenticated dashboard and public widget)
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

    // Handle reset action - clears all Voiceflow variables
    if (action === 'reset') {
      console.log('Resetting Voiceflow state for user:', userId);
      
      const deleteResponse = await fetch(
        `https://general-runtime.voiceflow.com/state/user/${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': apiKey,
          },
        }
      );
      
      if (!deleteResponse.ok) {
        console.warn('Failed to delete Voiceflow state:', await deleteResponse.text());
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'State reset complete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

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

    // Check for conversation end trace
    let isConversationEnded = false;
    if (voiceflowData && Array.isArray(voiceflowData)) {
      for (const item of voiceflowData) {
        if (item.type === 'end') {
          isConversationEnded = true;
          console.log('Detected conversation end trace from Voiceflow');
          break;
        }
      }
    }

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
    
    // Create conversation for any action including launch (so welcome messages are stored)
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

    // Store user message in transcripts (only if conversation exists)
    if ((action === 'text' || action === 'button') && currentConversationId) {
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

    // Store bot responses in transcripts (only if conversation exists)
    if (currentConversationId) {
      for (const response of botResponses) {
        const { error: botTranscriptError } = await supabaseClient
          .from('transcripts')
          .insert({
            conversation_id: currentConversationId,
            speaker: 'assistant',
            text: response.text || '',
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
    }

    // If conversation ended, update it and create transcript
    if (isConversationEnded && currentConversationId) {
      const endedAt = new Date().toISOString();
      console.log('Ending conversation and creating transcript:', currentConversationId);
      
      // Update conversation with ended_at
      const { error: endError } = await supabaseClient
        .from('conversations')
        .update({ 
          ended_at: endedAt,
          status: 'completed' 
        })
        .eq('id', currentConversationId);

      if (endError) {
        console.error('Error ending conversation:', endError);
      } else {
        // Fetch conversation data for transcript creation
        const { data: convData, error: convFetchError } = await supabaseClient
          .from('conversations')
          .select('id, agent_id, started_at, ended_at, metadata')
          .eq('id', currentConversationId)
          .single();

        if (convFetchError) {
          console.error('Error fetching conversation for transcript:', convFetchError);
        } else if (convData) {
          try {
            await createTranscriptForConversation(supabaseClient, convData);
          } catch (transcriptError) {
            console.error('Error creating transcript:', transcriptError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        conversationId: currentConversationId,
        botResponses,
        userId,
        conversationEnded: isConversationEnded,
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