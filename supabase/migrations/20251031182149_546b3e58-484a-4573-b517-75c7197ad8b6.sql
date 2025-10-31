-- Add full logo columns to platform_branding table
ALTER TABLE platform_branding
  ADD COLUMN IF NOT EXISTS full_logo_light_url TEXT,
  ADD COLUMN IF NOT EXISTS full_logo_dark_url TEXT;

-- Add full logo columns to agencies table
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS full_logo_light_url TEXT,
  ADD COLUMN IF NOT EXISTS full_logo_dark_url TEXT;

-- Drop and recreate get_agencies_overview_data function with new logo fields
DROP FUNCTION IF EXISTS public.get_agencies_overview_data();

CREATE OR REPLACE FUNCTION public.get_agencies_overview_data()
 RETURNS TABLE(
   id uuid,
   name text,
   slug text,
   logo_light_url text,
   logo_dark_url text,
   full_logo_light_url text,
   full_logo_dark_url text,
   support_email text,
   is_active boolean,
   created_at timestamp with time zone,
   trial_ends_at timestamp with time zone,
   owner_id uuid,
   subscription_status text,
   current_clients integer,
   current_agents integer,
   current_team_members integer,
   is_custom_pricing boolean,
   custom_price_monthly_cents integer,
   plan_name text,
   plan_price_cents integer,
   display_price_cents integer
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    a.id,
    a.name,
    a.slug,
    a.logo_light_url,
    a.logo_dark_url,
    a.full_logo_light_url,
    a.full_logo_dark_url,
    a.support_email,
    a.is_active,
    a.created_at,
    a.trial_ends_at,
    a.owner_id,
    
    sub.status::TEXT as subscription_status,
    sub.current_clients,
    sub.current_agents,
    sub.current_team_members,
    sub.is_custom_pricing,
    sub.custom_price_monthly_cents,
    
    sp.name as plan_name,
    sp.price_monthly_cents as plan_price_cents,
    
    CASE 
      WHEN sub.is_custom_pricing THEN sub.custom_price_monthly_cents
      ELSE sp.price_monthly_cents
    END as display_price_cents
    
  FROM agencies a
  LEFT JOIN agency_subscriptions sub ON sub.agency_id = a.id
  LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
  ORDER BY a.created_at DESC;
$function$;