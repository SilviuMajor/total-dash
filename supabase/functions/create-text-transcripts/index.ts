import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Agent {
  id: string;
  provider: string;
  config: {
    auto_end_hours?: number;
    transcript_delay_hours?: number; // Legacy support
  };
}

interface Conversation {
  id: string;
  agent_id: string;
  started_at: string;
  ended_at: string | null;
  metadata: {
    variables?: {
      user_name?: string;
      user_email?: string;
      user_phone?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
}

// Helper function to create a transcript for a conversation
async function createTranscriptForConversation(
  supabaseAdmin: any,
  conv: Conversation
): Promise<boolean> {
  try {
    // Fetch all messages for this conversation
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('transcripts')
      .select('speaker, text, timestamp, buttons, metadata')
      .eq('conversation_id', conv.id)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error(`Error fetching messages for conversation ${conv.id}:`, messagesError);
      return false;
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
    const capturedVariables = conv.metadata?.variables || {};
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
      return false;
    }

    console.log(`Created transcript for conversation ${conv.id}`);
    return true;
  } catch (error) {
    console.error(`Error processing conversation ${conv.id}:`, error);
    return false;
  }
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

    let totalAutoEnded = 0;
    let totalTranscriptsCreated = 0;

    // Get all existing transcript source_conversation_ids upfront
    const { data: existingTranscripts, error: existingError } = await supabaseAdmin
      .from('text_transcripts')
      .select('source_conversation_id');

    if (existingError) {
      console.error('Error fetching existing transcripts:', existingError);
      throw existingError;
    }

    const existingTranscriptIds = new Set(
      (existingTranscripts || []).map(t => t.source_conversation_id)
    );
    console.log(`Found ${existingTranscriptIds.size} existing transcripts`);

    for (const agent of (agents as Agent[])) {
      // Support both new 'auto_end_hours' and legacy 'transcript_delay_hours'
      const autoEndHours = agent.config?.auto_end_hours || agent.config?.transcript_delay_hours || 12;
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - autoEndHours);

      console.log(`Processing agent ${agent.id} with ${autoEndHours}h auto-end delay`);

      // ============================================
      // JOB 1: Auto-end stale conversations
      // ============================================
      // Find conversations that are still active but started before the cutoff
      const { data: staleConversations, error: staleError } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('agent_id', agent.id)
        .is('ended_at', null)
        .lt('started_at', cutoffTime.toISOString());

      if (staleError) {
        console.error(`Error fetching stale conversations for agent ${agent.id}:`, staleError);
        continue;
      }

      console.log(`Found ${staleConversations?.length || 0} stale conversations to auto-end`);

      // Auto-end each stale conversation
      for (const staleConv of (staleConversations || [])) {
        const { error: endError } = await supabaseAdmin
          .from('conversations')
          .update({ 
            ended_at: new Date().toISOString(),
            status: 'completed'
          })
          .eq('id', staleConv.id);

        if (endError) {
          console.error(`Error auto-ending conversation ${staleConv.id}:`, endError);
        } else {
          console.log(`Auto-ended conversation ${staleConv.id}`);
          totalAutoEnded++;
        }
      }

      // ============================================
      // JOB 2: Create transcripts for ended conversations
      // ============================================
      // Find all ended conversations for this agent
      const { data: endedConversations, error: endedError } = await supabaseAdmin
        .from('conversations')
        .select('id, agent_id, started_at, ended_at, metadata')
        .eq('agent_id', agent.id)
        .not('ended_at', 'is', null);

      if (endedError) {
        console.error(`Error fetching ended conversations for agent ${agent.id}:`, endedError);
        continue;
      }

      // Filter to conversations that don't have transcripts yet
      const conversationsNeedingTranscripts = (endedConversations || []).filter(
        (conv: Conversation) => !existingTranscriptIds.has(conv.id)
      );

      console.log(`Found ${conversationsNeedingTranscripts.length} ended conversations needing transcripts`);

      // Create transcripts for each
      for (const conv of conversationsNeedingTranscripts) {
        const success = await createTranscriptForConversation(supabaseAdmin, conv);
        if (success) {
          totalTranscriptsCreated++;
          // Add to set so we don't process twice if there's overlap
          existingTranscriptIds.add(conv.id);
        }
      }
    }

    console.log(`Job complete. Auto-ended: ${totalAutoEnded}, Transcripts created: ${totalTranscriptsCreated}`);

    return new Response(
      JSON.stringify({
        success: true,
        autoEndedConversations: totalAutoEnded,
        transcriptsCreated: totalTranscriptsCreated,
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