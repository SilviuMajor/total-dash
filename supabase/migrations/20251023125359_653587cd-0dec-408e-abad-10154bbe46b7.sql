-- Phase 1: Multi-tenant White-label SaaS Foundation
-- Create enums for new role types

-- Agency role enum
CREATE TYPE public.agency_role AS ENUM ('owner', 'admin', 'user');

-- Subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free_trial', 'starter', 'professional', 'enterprise');

-- Subscription status enum
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- ============================================
-- SUPER ADMIN USERS TABLE
-- ============================================
CREATE TABLE public.super_admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.super_admin_users(user_id),
  page_permissions JSONB DEFAULT '{
    "agencies": true,
    "subscription_plans": true,
    "settings": true,
    "agent_types": true
  }'::jsonb
);

-- Enable RLS
ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AGENCIES TABLE (replaces single agency)
-- ============================================
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  support_email TEXT,
  
  -- White-label settings (from agency_settings)
  primary_color TEXT DEFAULT '#000000',
  secondary_color TEXT DEFAULT '#ffffff',
  custom_css TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  deleted_at TIMESTAMP WITH TIME ZONE,
  scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  
  -- Owner
  owner_id UUID NOT NULL,
  
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Enable RLS
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

-- Create index for lookups
CREATE INDEX idx_agencies_slug ON public.agencies(slug);
CREATE INDEX idx_agencies_custom_domain ON public.agencies(custom_domain);
CREATE INDEX idx_agencies_owner ON public.agencies(owner_id);

-- ============================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tier public.subscription_tier NOT NULL UNIQUE,
  
  -- Limits
  max_clients INTEGER NOT NULL DEFAULT 0,
  max_agents INTEGER NOT NULL DEFAULT 0,
  max_team_members INTEGER NOT NULL DEFAULT 1,
  has_whitelabel_access BOOLEAN DEFAULT false,
  has_support_access BOOLEAN DEFAULT false,
  
  -- Pricing (in cents)
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Insert default plans
INSERT INTO public.subscription_plans (name, tier, max_clients, max_agents, max_team_members, has_whitelabel_access, has_support_access, price_monthly_cents, description) VALUES
('Free Trial', 'free_trial', 2, 2, 1, false, false, 0, '7-day trial with limited features'),
('Starter', 'starter', 5, 5, 2, false, true, 4900, 'Perfect for small agencies'),
('Professional', 'professional', 15, 15, 5, true, true, 14900, 'For growing agencies with white-label'),
('Enterprise', 'enterprise', -1, -1, 20, true, true, 29900, 'Unlimited clients and agents');

-- ============================================
-- AGENCY SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE public.agency_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  
  -- Status
  status public.subscription_status DEFAULT 'trialing',
  
  -- Stripe data
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  
  -- Current usage (for display)
  current_clients INTEGER DEFAULT 0,
  current_agents INTEGER DEFAULT 0,
  current_team_members INTEGER DEFAULT 1,
  
  -- Billing cycle
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(agency_id)
);

-- Enable RLS
ALTER TABLE public.agency_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agency_subscriptions_agency ON public.agency_subscriptions(agency_id);
CREATE INDEX idx_agency_subscriptions_stripe ON public.agency_subscriptions(stripe_subscription_id);

-- ============================================
-- AGENCY USERS TABLE (team members)
-- ============================================
CREATE TABLE public.agency_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  role public.agency_role NOT NULL DEFAULT 'user',
  
  -- Permissions
  page_permissions JSONB DEFAULT '{
    "clients": true,
    "agents": true,
    "subscription": false,
    "settings": false
  }'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id, agency_id)
);

-- Enable RLS
ALTER TABLE public.agency_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agency_users_user ON public.agency_users(user_id);
CREATE INDEX idx_agency_users_agency ON public.agency_users(agency_id);

-- ============================================
-- MODIFY EXISTING TABLES TO ADD AGENCY_ID
-- ============================================

-- Add agency_id to clients
ALTER TABLE public.clients ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
CREATE INDEX idx_clients_agency ON public.clients(agency_id);

-- Add agency_id to agents
ALTER TABLE public.agents ADD COLUMN agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE;
CREATE INDEX idx_agents_agency ON public.agents(agency_id);

-- Update agency_settings to link to agencies table (backward compatibility)
ALTER TABLE public.agency_settings ADD COLUMN agency_id UUID UNIQUE REFERENCES public.agencies(id) ON DELETE CASCADE;

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admin_users
    WHERE user_id = _user_id
  )
$$;

-- Get user's agency ID
CREATE OR REPLACE FUNCTION public.get_user_agency_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.agency_users
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Check if user has agency role
CREATE OR REPLACE FUNCTION public.has_agency_role(_user_id UUID, _agency_id UUID, _role public.agency_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agency_users
    WHERE user_id = _user_id
      AND agency_id = _agency_id
      AND role = _role
  )
$$;

-- Check if user is agency owner
CREATE OR REPLACE FUNCTION public.is_agency_owner(_user_id UUID, _agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.agencies
    WHERE id = _agency_id
      AND owner_id = _user_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM public.agency_users
    WHERE user_id = _user_id
      AND agency_id = _agency_id
      AND role = 'owner'
  )
$$;

-- Check agency subscription limits
CREATE OR REPLACE FUNCTION public.check_agency_limit(_agency_id UUID, _limit_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription RECORD;
  v_plan RECORD;
  v_current_count INTEGER;
BEGIN
  -- Get subscription and plan
  SELECT s.*, p.max_clients, p.max_agents, p.max_team_members
  INTO v_subscription
  FROM public.agency_subscriptions s
  JOIN public.subscription_plans p ON s.plan_id = p.id
  WHERE s.agency_id = _agency_id
    AND s.status IN ('trialing', 'active')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check specific limit
  CASE _limit_type
    WHEN 'clients' THEN
      IF v_subscription.max_clients = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count FROM public.clients WHERE agency_id = _agency_id AND deleted_at IS NULL;
      RETURN v_current_count < v_subscription.max_clients;
      
    WHEN 'agents' THEN
      IF v_subscription.max_agents = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count FROM public.agents WHERE agency_id = _agency_id;
      RETURN v_current_count < v_subscription.max_agents;
      
    WHEN 'team_members' THEN
      IF v_subscription.max_team_members = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count FROM public.agency_users WHERE agency_id = _agency_id;
      RETURN v_current_count < v_subscription.max_team_members;
      
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- Get agency whitelabel access
CREATE OR REPLACE FUNCTION public.has_whitelabel_access(_agency_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.has_whitelabel_access
      FROM public.agency_subscriptions s
      JOIN public.subscription_plans p ON s.plan_id = p.id
      WHERE s.agency_id = _agency_id
        AND s.status IN ('trialing', 'active')
      LIMIT 1
    ),
    false
  )
$$;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

-- Super Admin Users Policies
CREATE POLICY "Super admins can view all super admin users"
  ON public.super_admin_users FOR SELECT
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can manage super admin users"
  ON public.super_admin_users FOR ALL
  USING (is_super_admin(auth.uid()));

-- Agencies Policies
CREATE POLICY "Super admins can manage all agencies"
  ON public.agencies FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can view their agency"
  ON public.agencies FOR SELECT
  USING (
    id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Agency owners can update their agency"
  ON public.agencies FOR UPDATE
  USING (
    owner_id = auth.uid() OR
    is_agency_owner(auth.uid(), id)
  );

-- Subscription Plans Policies
CREATE POLICY "Super admins can manage subscription plans"
  ON public.subscription_plans FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Anyone can view active subscription plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- Agency Subscriptions Policies
CREATE POLICY "Super admins can manage all agency subscriptions"
  ON public.agency_subscriptions FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can view their subscription"
  ON public.agency_subscriptions FOR SELECT
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Agency owners can update their subscription"
  ON public.agency_subscriptions FOR UPDATE
  USING (
    is_agency_owner(auth.uid(), agency_id)
  );

-- Agency Users Policies
CREATE POLICY "Super admins can manage all agency users"
  ON public.agency_users FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can view team members"
  ON public.agency_users FOR SELECT
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Agency owners can manage team members"
  ON public.agency_users FOR ALL
  USING (
    is_agency_owner(auth.uid(), agency_id)
  );

CREATE POLICY "Users can view their own agency associations"
  ON public.agency_users FOR SELECT
  USING (user_id = auth.uid());

-- ============================================
-- UPDATE EXISTING RLS POLICIES
-- ============================================

-- Update clients policies to include agency_id checks
DROP POLICY IF EXISTS "Admins can do everything with clients" ON public.clients;
DROP POLICY IF EXISTS "Client users can view their clients" ON public.clients;

CREATE POLICY "Super admins can manage all clients"
  ON public.clients FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage their agency clients"
  ON public.clients FOR ALL
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

-- Update agents policies
DROP POLICY IF EXISTS "Admins can do everything with agents" ON public.agents;
DROP POLICY IF EXISTS "Client users can view assigned agents" ON public.agents;

CREATE POLICY "Super admins can manage all agents"
  ON public.agents FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage their agency agents"
  ON public.agents FOR ALL
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

-- Keep client user access to assigned agents
CREATE POLICY "Client users can view assigned agents"
  ON public.agents FOR SELECT
  USING (
    id IN (
      SELECT aa.agent_id
      FROM agent_assignments aa
      WHERE aa.client_id IN (
        SELECT client_id FROM get_user_client_ids(auth.uid())
      )
    )
  );

-- Update agency_settings policies
DROP POLICY IF EXISTS "Admins can manage agency settings" ON public.agency_settings;

CREATE POLICY "Super admins can manage all agency settings"
  ON public.agency_settings FOR ALL
  USING (is_super_admin(auth.uid()));

CREATE POLICY "Agency users can manage their agency settings"
  ON public.agency_settings FOR ALL
  USING (
    agency_id IN (SELECT agency_id FROM public.agency_users WHERE user_id = auth.uid())
  );

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Auto-update agency subscription usage counts
CREATE OR REPLACE FUNCTION public.update_agency_subscription_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'clients' THEN
    UPDATE public.agency_subscriptions
    SET current_clients = (
      SELECT COUNT(*) FROM public.clients 
      WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id) 
        AND deleted_at IS NULL
    )
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
    
  ELSIF TG_TABLE_NAME = 'agents' THEN
    UPDATE public.agency_subscriptions
    SET current_agents = (
      SELECT COUNT(*) FROM public.agents 
      WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id)
    )
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
    
  ELSIF TG_TABLE_NAME = 'agency_users' THEN
    UPDATE public.agency_subscriptions
    SET current_team_members = (
      SELECT COUNT(*) FROM public.agency_users 
      WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id)
    )
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Attach triggers
CREATE TRIGGER update_client_usage_count
  AFTER INSERT OR UPDATE OR DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_agent_usage_count
  AFTER INSERT OR UPDATE OR DELETE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

CREATE TRIGGER update_team_member_usage_count
  AFTER INSERT OR UPDATE OR DELETE ON public.agency_users
  FOR EACH ROW EXECUTE FUNCTION public.update_agency_subscription_usage();

-- Set first agency user as owner
CREATE OR REPLACE FUNCTION public.set_first_agency_user_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.agency_users 
    WHERE agency_id = NEW.agency_id
  ) THEN
    NEW.role := 'owner';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_agency_owner_role
  BEFORE INSERT ON public.agency_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_agency_user_as_owner();

-- ============================================
-- DATA MIGRATION: Convert Fiveleaf to Agency
-- ============================================

-- Create Fiveleaf agency from existing agency_settings
DO $$
DECLARE
  v_fiveleaf_agency_id UUID;
  v_settings RECORD;
  v_first_admin_id UUID;
BEGIN
  -- Get existing agency settings
  SELECT * INTO v_settings FROM public.agency_settings LIMIT 1;
  
  -- Find first admin user as owner
  SELECT id INTO v_first_admin_id 
  FROM public.profiles 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  -- Create Fiveleaf agency
  INSERT INTO public.agencies (
    name,
    slug,
    domain,
    logo_url,
    support_email,
    primary_color,
    secondary_color,
    custom_css,
    owner_id,
    trial_ends_at
  ) VALUES (
    COALESCE(v_settings.agency_name, 'Fiveleaf'),
    'fiveleaf',
    COALESCE(v_settings.agency_domain, 'fiveleaf'),
    v_settings.agency_logo_url,
    v_settings.support_email,
    '#000000',
    '#ffffff',
    NULL,
    v_first_admin_id,
    NULL -- No trial, full access
  )
  RETURNING id INTO v_fiveleaf_agency_id;
  
  -- Link agency_settings to new agency
  UPDATE public.agency_settings
  SET agency_id = v_fiveleaf_agency_id
  WHERE id = v_settings.id;
  
  -- Create Enterprise subscription for Fiveleaf (unlimited)
  INSERT INTO public.agency_subscriptions (
    agency_id,
    plan_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    v_fiveleaf_agency_id,
    (SELECT id FROM public.subscription_plans WHERE tier = 'enterprise' LIMIT 1),
    'active',
    now(),
    now() + interval '1 year'
  );
  
  -- Add all existing admin users to Fiveleaf agency
  INSERT INTO public.agency_users (user_id, agency_id, role, page_permissions)
  SELECT 
    id,
    v_fiveleaf_agency_id,
    CASE 
      WHEN id = v_first_admin_id THEN 'owner'::agency_role
      ELSE 'admin'::agency_role
    END,
    '{
      "clients": true,
      "agents": true,
      "subscription": true,
      "settings": true
    }'::jsonb
  FROM public.profiles
  WHERE role = 'admin';
  
  -- Assign all existing clients to Fiveleaf
  UPDATE public.clients
  SET agency_id = v_fiveleaf_agency_id
  WHERE agency_id IS NULL;
  
  -- Assign all existing agents to Fiveleaf
  UPDATE public.agents
  SET agency_id = v_fiveleaf_agency_id
  WHERE agency_id IS NULL;
  
  -- Create first super admin (the owner)
  INSERT INTO public.super_admin_users (user_id, page_permissions)
  VALUES (
    v_first_admin_id,
    '{
      "agencies": true,
      "subscription_plans": true,
      "settings": true,
      "agent_types": true
    }'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  
END $$;