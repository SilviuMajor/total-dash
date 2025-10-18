-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table with proper structure
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, client_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _client_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND client_id = _client_id
      AND role = _role
  )
$$;

-- Migrate existing role data from client_users to user_roles
INSERT INTO public.user_roles (user_id, client_id, role)
SELECT 
  user_id, 
  client_id, 
  CASE 
    WHEN role = 'admin' THEN 'admin'::app_role
    ELSE 'user'::app_role
  END as role
FROM public.client_users
WHERE role IS NOT NULL
ON CONFLICT (user_id, client_id, role) DO NOTHING;

-- Remove role column from client_users
ALTER TABLE public.client_users DROP COLUMN IF EXISTS role;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view client roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), client_id, 'admin'::app_role)
);

CREATE POLICY "Admins can manage client roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), client_id, 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), client_id, 'admin'::app_role)
);

-- Drop existing functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.set_first_user_as_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_last_admin(uuid, uuid) CASCADE;

-- Recreate trigger function to use user_roles
CREATE OR REPLACE FUNCTION public.set_first_user_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if this is the first user for the client
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE client_id = NEW.client_id
  ) THEN
    -- Insert admin role for first user
    INSERT INTO public.user_roles (user_id, client_id, role)
    VALUES (NEW.user_id, NEW.client_id, 'admin'::app_role);
  ELSE
    -- Insert regular user role
    INSERT INTO public.user_roles (user_id, client_id, role)
    VALUES (NEW.user_id, NEW.client_id, 'user'::app_role)
    ON CONFLICT (user_id, client_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_first_user_as_admin
  AFTER INSERT ON public.client_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_user_as_admin();

-- Create helper function to check if user is last admin
CREATE OR REPLACE FUNCTION public.is_last_admin(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT COUNT(*) 
    FROM public.user_roles 
    WHERE client_id = _client_id 
      AND role = 'admin'::app_role
  ) = 1
  AND EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id 
      AND client_id = _client_id 
      AND role = 'admin'::app_role
  )
$$;