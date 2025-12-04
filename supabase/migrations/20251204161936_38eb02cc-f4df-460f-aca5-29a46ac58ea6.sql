-- Add last_activity_at column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN last_activity_at timestamp with time zone DEFAULT now();

-- Backfill existing conversations with their latest message timestamp
UPDATE public.conversations c
SET last_activity_at = COALESCE(
  (SELECT MAX(t.timestamp) FROM public.transcripts t WHERE t.conversation_id = c.id),
  c.started_at
);

-- Create index for efficient querying
CREATE INDEX idx_conversations_last_activity_at ON public.conversations(last_activity_at);