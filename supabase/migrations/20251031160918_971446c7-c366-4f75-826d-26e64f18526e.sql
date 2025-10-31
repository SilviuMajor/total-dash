-- Function for agencies overview page
CREATE OR REPLACE FUNCTION get_agencies_overview_data()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  logo_url TEXT,
  support_email TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  owner_id UUID,
  subscription_status TEXT,
  current_clients INTEGER,
  current_agents INTEGER,
  current_team_members INTEGER,
  is_custom_pricing BOOLEAN,
  custom_price_monthly_cents INTEGER,
  plan_name TEXT,
  plan_price_cents INTEGER,
  display_price_cents INTEGER
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id,
    a.name,
    a.slug,
    a.logo_url,
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
$$;

-- Function for billing data page
CREATE OR REPLACE FUNCTION get_billing_data_detailed()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  created_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT,
  current_clients INTEGER,
  current_agents INTEGER,
  current_team_members INTEGER,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  is_custom_pricing BOOLEAN,
  is_custom_limits BOOLEAN,
  custom_price_monthly_cents INTEGER,
  plan_name TEXT,
  plan_price_cents INTEGER,
  display_price_cents INTEGER,
  max_clients INTEGER,
  max_agents INTEGER,
  max_team_members INTEGER
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    a.id,
    a.name,
    a.slug,
    a.created_at,
    a.trial_ends_at,
    
    sub.status::TEXT as subscription_status,
    sub.current_clients,
    sub.current_agents,
    sub.current_team_members,
    sub.stripe_subscription_id,
    sub.stripe_customer_id,
    sub.current_period_start,
    sub.current_period_end,
    sub.is_custom_pricing,
    sub.is_custom_limits,
    sub.custom_price_monthly_cents,
    
    sp.name as plan_name,
    sp.price_monthly_cents as plan_price_cents,
    
    CASE 
      WHEN sub.is_custom_pricing THEN sub.custom_price_monthly_cents
      ELSE sp.price_monthly_cents
    END as display_price_cents,
    
    CASE 
      WHEN sub.is_custom_limits THEN sub.custom_max_clients
      ELSE sp.max_clients
    END as max_clients,
    
    CASE 
      WHEN sub.is_custom_limits THEN sub.custom_max_agents
      ELSE sp.max_agents
    END as max_agents,
    
    CASE 
      WHEN sub.is_custom_limits THEN sub.custom_max_team_members
      ELSE sp.max_team_members
    END as max_team_members
    
  FROM agencies a
  LEFT JOIN agency_subscriptions sub ON sub.agency_id = a.id
  LEFT JOIN subscription_plans sp ON sp.id = sub.plan_id
  ORDER BY a.created_at DESC;
$$;