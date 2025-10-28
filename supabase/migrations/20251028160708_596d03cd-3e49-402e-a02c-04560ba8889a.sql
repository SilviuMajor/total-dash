-- Fix check_agency_limit RPC function to use <= instead of <
CREATE OR REPLACE FUNCTION public.check_agency_limit(_agency_id uuid, _limit_type text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_subscription RECORD;
  v_current_count INTEGER;
BEGIN
  -- Get subscription with limits
  SELECT 
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_clients
      ELSE p.max_clients
    END as max_clients,
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_agents
      ELSE p.max_agents
    END as max_agents,
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_team_members
      ELSE p.max_team_members
    END as max_team_members
  INTO v_subscription
  FROM public.agency_subscriptions s
  JOIN public.subscription_plans p ON s.plan_id = p.id
  WHERE s.agency_id = _agency_id
    AND s.status IN ('trialing', 'active')
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check specific limit using <= instead of <
  CASE _limit_type
    WHEN 'clients' THEN
      IF v_subscription.max_clients = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count 
      FROM public.clients 
      WHERE agency_id = _agency_id AND deleted_at IS NULL;
      RETURN v_current_count < v_subscription.max_clients;
      
    WHEN 'agents' THEN
      IF v_subscription.max_agents = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count 
      FROM public.agents 
      WHERE agency_id = _agency_id;
      RETURN v_current_count < v_subscription.max_agents;
      
    WHEN 'team_members' THEN
      IF v_subscription.max_team_members = -1 THEN
        RETURN true;
      END IF;
      SELECT COUNT(*) INTO v_current_count 
      FROM public.agency_users 
      WHERE agency_id = _agency_id;
      RETURN v_current_count < v_subscription.max_team_members;
      
    ELSE
      RETURN false;
  END CASE;
END;
$function$;

-- Trigger functions to auto-update current counts
CREATE OR REPLACE FUNCTION update_agency_client_count()
RETURNS trigger AS $$
BEGIN
  UPDATE agency_subscriptions
  SET current_clients = (
    SELECT COUNT(*) 
    FROM clients 
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id) 
      AND deleted_at IS NULL
  )
  WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agency_agent_count()
RETURNS trigger AS $$
BEGIN
  UPDATE agency_subscriptions
  SET current_agents = (
    SELECT COUNT(*) 
    FROM agents 
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id)
  )
  WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_agency_team_count()
RETURNS trigger AS $$
BEGIN
  UPDATE agency_subscriptions
  SET current_team_members = (
    SELECT COUNT(*) 
    FROM agency_users 
    WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id)
  )
  WHERE agency_id = COALESCE(NEW.agency_id, OLD.agency_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS clients_count_trigger ON clients;
DROP TRIGGER IF EXISTS agents_count_trigger ON agents;
DROP TRIGGER IF EXISTS team_count_trigger ON agency_users;

-- Create triggers for auto-updating counts
CREATE TRIGGER clients_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW
EXECUTE FUNCTION update_agency_client_count();

CREATE TRIGGER agents_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON agents
FOR EACH ROW
EXECUTE FUNCTION update_agency_agent_count();

CREATE TRIGGER team_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON agency_users
FOR EACH ROW
EXECUTE FUNCTION update_agency_team_count();

-- BEFORE INSERT triggers to block creation when over limit
CREATE OR REPLACE FUNCTION enforce_client_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  -- Get the limit from subscription
  SELECT 
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_clients
      ELSE p.max_clients
    END
  INTO v_limit
  FROM agency_subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.agency_id = NEW.agency_id
    AND s.status IN ('trialing', 'active')
  LIMIT 1;
  
  -- If unlimited (-1), allow
  IF v_limit = -1 THEN
    RETURN NEW;
  END IF;
  
  -- Count current clients (excluding deleted)
  SELECT COUNT(*) INTO v_current
  FROM clients
  WHERE agency_id = NEW.agency_id
    AND deleted_at IS NULL;
  
  -- Block if at or over limit
  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'Client limit reached. Current: %, Max: %. Please upgrade your subscription plan.', v_current, v_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_agent_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  SELECT 
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_agents
      ELSE p.max_agents
    END
  INTO v_limit
  FROM agency_subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.agency_id = NEW.agency_id
    AND s.status IN ('trialing', 'active')
  LIMIT 1;
  
  IF v_limit = -1 THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO v_current
  FROM agents
  WHERE agency_id = NEW.agency_id;
  
  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'Agent limit reached. Current: %, Max: %. Please upgrade your subscription plan.', v_current, v_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_team_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  SELECT 
    CASE 
      WHEN s.is_custom_limits THEN s.custom_max_team_members
      ELSE p.max_team_members
    END
  INTO v_limit
  FROM agency_subscriptions s
  JOIN subscription_plans p ON s.plan_id = p.id
  WHERE s.agency_id = NEW.agency_id
    AND s.status IN ('trialing', 'active')
  LIMIT 1;
  
  IF v_limit = -1 THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO v_current
  FROM agency_users
  WHERE agency_id = NEW.agency_id;
  
  IF v_current >= v_limit THEN
    RAISE EXCEPTION 'Team member limit reached. Current: %, Max: %. Please upgrade your subscription plan.', v_current, v_limit;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS enforce_client_limit_trigger ON clients;
DROP TRIGGER IF EXISTS enforce_agent_limit_trigger ON agents;
DROP TRIGGER IF EXISTS enforce_team_limit_trigger ON agency_users;

-- Create enforcement triggers
CREATE TRIGGER enforce_client_limit_trigger
BEFORE INSERT ON clients
FOR EACH ROW
EXECUTE FUNCTION enforce_client_limit();

CREATE TRIGGER enforce_agent_limit_trigger
BEFORE INSERT ON agents
FOR EACH ROW
EXECUTE FUNCTION enforce_agent_limit();

CREATE TRIGGER enforce_team_limit_trigger
BEFORE INSERT ON agency_users
FOR EACH ROW
EXECUTE FUNCTION enforce_team_limit();

-- Add profile_access_control column to client_settings
ALTER TABLE client_settings 
ADD COLUMN IF NOT EXISTS profile_access_control jsonb DEFAULT '{
  "edit_name": "all",
  "change_email": "admin_only",
  "change_password": "all"
}'::jsonb;