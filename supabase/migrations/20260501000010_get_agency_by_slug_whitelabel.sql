-- Extend get_agency_by_slug to also return whitelabel domain fields, so
-- SlugBasedAuth can decide whether to redirect to a verified custom domain.
-- Whitelabel fields are public-facing (the URL itself and verification flag) —
-- no sensitive credentials are exposed.

CREATE OR REPLACE FUNCTION public.get_agency_by_slug(p_slug TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', a.id,
    'name', a.name,
    'slug', a.slug,
    'logo_light_url', a.logo_light_url,
    'logo_dark_url', a.logo_dark_url,
    'full_logo_light_url', a.full_logo_light_url,
    'full_logo_dark_url', a.full_logo_dark_url,
    'favicon_light_url', a.favicon_light_url,
    'favicon_dark_url', a.favicon_dark_url,
    'primary_color', a.primary_color,
    'secondary_color', a.secondary_color,
    'whitelabel_subdomain', a.whitelabel_subdomain,
    'whitelabel_domain', a.whitelabel_domain,
    'whitelabel_verified', a.whitelabel_verified
  ) INTO result
  FROM agencies a
  WHERE a.slug = p_slug;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_by_slug(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_agency_by_slug(TEXT) TO authenticated;
