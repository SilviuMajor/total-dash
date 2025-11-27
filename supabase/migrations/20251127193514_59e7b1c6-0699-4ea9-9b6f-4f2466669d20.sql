-- Create text_transcripts table for storing conversation snapshots
CREATE TABLE public.text_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Source reference (original conversation stays untouched)
  source_conversation_id UUID NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  
  -- User information snapshot
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  
  -- Conversation metadata snapshot
  conversation_started_at TIMESTAMPTZ NOT NULL,
  conversation_ended_at TIMESTAMPTZ,
  duration INTEGER, -- in seconds
  message_count INTEGER DEFAULT 0,
  
  -- Complete snapshot of variables and metadata
  captured_variables JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  sentiment TEXT,
  
  -- The actual messages (full hard copy)
  messages JSONB NOT NULL DEFAULT '[]',
  
  -- Transcript metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX idx_text_transcripts_agent_id ON text_transcripts(agent_id);
CREATE INDEX idx_text_transcripts_created_at ON text_transcripts(created_at DESC);
CREATE INDEX idx_text_transcripts_user_name ON text_transcripts(user_name);
CREATE INDEX idx_text_transcripts_source_conversation ON text_transcripts(source_conversation_id);

-- Enable RLS
ALTER TABLE public.text_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Client users can view text transcripts for their agents"
  ON public.text_transcripts FOR SELECT
  USING (
    agent_id IN (
      SELECT agent_id FROM agent_assignments 
      WHERE client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid()))
    ) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can manage text transcripts"
  ON public.text_transcripts FOR ALL
  USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage text transcripts for their agents"
  ON public.text_transcripts FOR ALL
  USING (
    agent_id IN (
      SELECT id FROM agents WHERE agency_id IN (
        SELECT agency_id FROM agency_users WHERE user_id = auth.uid()
      )
    ) OR is_super_admin(auth.uid())
  );