-- Add metadata and buttons columns to transcripts for enhanced conversation tracking
ALTER TABLE transcripts 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS buttons JSONB;

-- Add index for faster variable lookups in conversations
CREATE INDEX IF NOT EXISTS idx_conversations_metadata 
ON conversations USING gin(metadata);

COMMENT ON COLUMN transcripts.metadata IS 'Stores button click info, Voiceflow traces, and timing data';
COMMENT ON COLUMN transcripts.buttons IS 'Stores button options sent by agent in structured format';