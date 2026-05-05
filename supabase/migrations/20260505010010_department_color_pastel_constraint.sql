-- Constrain departments.color to the curated pastel family names while
-- still permitting legacy hex values (#RRGGBB) so existing rows keep
-- rendering. New writes from the dashboard will use family names.
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.departments'::regclass
      AND pg_get_constraintdef(oid) ILIKE '%color%'
  LOOP
    EXECUTE format('ALTER TABLE public.departments DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.departments
  ADD CONSTRAINT departments_color_check
  CHECK (
    color IS NULL
    OR color IN ('sage','rose','peach','sand','lime','teal','sky','lav','berry')
    OR color ~* '^#[0-9a-f]{6}$'
  );

ALTER TABLE public.departments
  ALTER COLUMN color SET DEFAULT 'sky';
