-- Enable full replica identity for complete row data in realtime events
ALTER TABLE public.transcripts REPLICA IDENTITY FULL;

-- Add transcripts table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.transcripts;