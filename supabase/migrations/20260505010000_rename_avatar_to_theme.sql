-- Rename profiles.avatar_color to profiles.theme_color and widen the
-- allowed values to the full curated palette (8 colours; sage stays
-- excluded because it's reserved for the AI / with_ai status colour).
ALTER TABLE public.profiles
  RENAME COLUMN avatar_color TO theme_color;

-- Drop the old constraint (it referenced a subset of allowed values).
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%avatar_color%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_color_check
  CHECK (
    theme_color IS NULL
    OR theme_color IN ('rose','peach','sand','lime','teal','sky','lav','berry')
  );
