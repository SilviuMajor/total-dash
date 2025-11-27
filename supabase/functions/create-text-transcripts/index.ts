import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Agent {
  id: string;
  provider: string;
  config: {
    transcript_delay_hours?: number;
  };
}

interface Conversation {
  id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
  metadata: {
    user_name?: string;
    user_email?: string;
    user_phone?: string;
    [key: string]: any;
  };
}

interface Transcript {
  speaker: string;
  text: string;
  timestamp: string;
  buttons?: any;
  metadata?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('Starting transcript creation job...');

    // Get all Voiceflow agents
    const { data: agents, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('id, provider, config')
      .eq('provider', 'voiceflow');

    if (agentsError) throw agentsError;

    console.log(`Found ${agents?.length || 0} Voiceflow agents`);

    let totalCreated = 0;

    for (const agent of (agents as Agent[])) {
      const delayHours = agent.config?.transcript_delay_hours || 12;
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - delayHours);

      console.log(`Processing agent ${agent.id} with ${delayHours}h delay`);

      // Find conversations older than the delay that don't have transcripts yet
      const { data: conversations, error: convsError } = await supabaseAdmin
        .from('conversations')
        .select('id, agent_id, started_at, ended_at, metadata')
        .eq('agent_id', agent.id)
        .lt('started_at', cutoffTime.toISOString())
        .not('id', 'in', `(
          SELECT source_conversation_id FROM text_transcripts
        )`);

      if (convsError) {
        console.error(`Error fetching conversations for agent ${agent.id}:`, convsError);
        continue;
      }

      console.log(`Found ${conversations?.length || 0} conversations to process`);

      for (const conv of (conversations as Conversation[])) {
        try {
          // Fetch all messages for this conversation
          const { data: messages, error: messagesError } = await supabaseAdmin
            .from('transcripts')
            .select('speaker, text, timestamp, buttons, metadata')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: true });

          if (messagesError) {
            console.error(`Error fetching messages for conversation ${conv.id}:`, messagesError);
            continue;
          }

          const messageCount = messages?.length || 0;

          // Calculate duration
          let duration = null;
          if (conv.ended_at && conv.started_at) {
            const start = new Date(conv.started_at).getTime();
            const end = new Date(conv.ended_at).getTime();
            duration = Math.floor((end - start) / 1000); // seconds
          }

          // Extract variables from metadata
          const capturedVariables = conv.metadata || {};
          const userName = capturedVariables.user_name || null;
          const userEmail = capturedVariables.user_email || null;
          const userPhone = capturedVariables.user_phone || null;

          // Create the transcript
          const { error: insertError } = await supabaseAdmin
            .from('text_transcripts')
            .insert({
              source_conversation_id: conv.id,
              agent_id: conv.agent_id,
              user_name: userName,
              user_email: userEmail,
              user_phone: userPhone,
              conversation_started_at: conv.started_at,
              conversation_ended_at: conv.ended_at,
              duration: duration,
              message_count: messageCount,
              captured_variables: capturedVariables,
              messages: messages || [],
            });

          if (insertError) {
            console.error(`Error creating transcript for conversation ${conv.id}:`, insertError);
            continue;
          }

          totalCreated++;
          console.log(`Created transcript for conversation ${conv.id}`);
        } catch (error) {
          console.error(`Error processing conversation ${conv.id}:`, error);
        }
      }
    }

    console.log(`Job complete. Created ${totalCreated} transcripts.`);

    return new Response(
      JSON.stringify({
        success: true,
        transcriptsCreated: totalCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-text-transcripts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});