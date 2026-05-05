-- The previous migration's dynamic constraint-drop loop missed the old
-- constraint because column-rename leaves the constraint *name* unchanged
-- but rewrites the constraint *definition* to reference the new column
-- (theme_color), so an ILIKE '%avatar_color%' filter no longer matched.
-- Drop it by name now so theme_color writes accept the full 8-colour set.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_color_check;
