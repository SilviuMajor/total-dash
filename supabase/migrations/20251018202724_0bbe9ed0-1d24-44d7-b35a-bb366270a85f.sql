-- Remove feature_request_email from agency_settings (no longer needed)
ALTER TABLE agency_settings 
DROP COLUMN IF EXISTS feature_request_email;

-- Add custom_guide_sections to client_settings for client-specific guides
ALTER TABLE client_settings 
ADD COLUMN IF NOT EXISTS custom_guide_sections JSONB DEFAULT '[]'::jsonb;

-- Create function to ensure first user for a client is automatically set as admin
CREATE OR REPLACE FUNCTION public.set_first_user_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user for this client
  IF NOT EXISTS (
    SELECT 1 FROM client_users 
    WHERE client_id = NEW.client_id AND id != NEW.id
  ) THEN
    NEW.role := 'admin';
  ELSE
    -- Default to 'user' if role is not set
    IF NEW.role IS NULL THEN
      NEW.role := 'user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to ensure first user is admin
DROP TRIGGER IF EXISTS ensure_first_user_admin ON client_users;
CREATE TRIGGER ensure_first_user_admin
BEFORE INSERT ON client_users
FOR EACH ROW
EXECUTE FUNCTION public.set_first_user_as_admin();

-- Create function to check if user is the last admin for a client
CREATE OR REPLACE FUNCTION public.is_last_admin(_client_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*) 
    FROM client_users 
    WHERE client_id = _client_id AND role = 'admin'
  ) = 1 AND EXISTS (
    SELECT 1 
    FROM client_users 
    WHERE client_id = _client_id AND user_id = _user_id AND role = 'admin'
  );
$$;