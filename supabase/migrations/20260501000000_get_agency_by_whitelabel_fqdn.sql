-- get_agency_by_whitelabel_fqdn — anonymous lookup of an agency by its
-- verified whitelabel domain (e.g. "dashboard.fiveleaf.co.uk").
--
-- Used by the frontend bootstrap hook (useCustomDomainAgency) when a user
-- lands on a custom domain. Mirrors get_agency_by_slug exactly: SECURITY
-- DEFINER, returns only the safe branding fields, accessible to anon and
-- authenticated.
--
-- The lookup explicitly requires whitelabel_verified = true so an
-- abandoned / mid-setup whitelabel domain doesn't render the agency's
-- branding before SSL is even live.

CREATE OR REPLACE FUNCTION public.get_agency_by_whitelabel_fqdn(p_fqdn TEXT)
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
    'secondary_color', a.secondary_color
  ) INTO result
  FROM agencies a
  WHERE a.whitelabel_verified = true
    AND a.whitelabel_domain IS NOT NULL
    AND lower(coalesce(a.whitelabel_subdomain, 'dashboard') || '.' || a.whitelabel_domain) = lower(p_fqdn);

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_by_whitelabel_fqdn(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_agency_by_whitelabel_fqdn(TEXT) TO authenticated;
