-- Add avatar_color preference to profiles. Nullable: when null, the avatar
-- falls back to the current primary-blue rendering. Allowed values are the
-- pastel families used elsewhere in the design system except sage (reserved
-- for the AI / with_ai status colour).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_color TEXT
  CHECK (avatar_color IS NULL OR avatar_color IN ('rose', 'sky', 'sand', 'lav', 'peach'));
