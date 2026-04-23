-- Allow NULL on transcripts.text
-- Button-only assistant messages have null text + populated buttons.
-- ~18% of historical transcript rows match this shape.

ALTER TABLE public.transcripts ALTER COLUMN text DROP NOT NULL;
