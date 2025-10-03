-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- RLS policies for departments
CREATE POLICY "Admins can manage all departments"
ON public.departments
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view their client's departments"
ON public.departments
FOR SELECT
USING (client_id IN (SELECT client_id FROM get_user_client_ids(auth.uid())));

-- Add columns to client_users table
ALTER TABLE public.client_users
ADD COLUMN full_name TEXT,
ADD COLUMN avatar_url TEXT,
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN page_permissions JSONB DEFAULT '{"dashboard": true, "analytics": true, "transcripts": true, "settings": false}'::jsonb;

-- Add column to client_settings table
ALTER TABLE public.client_settings
ADD COLUMN default_user_permissions JSONB DEFAULT '{"dashboard": true, "analytics": true, "transcripts": true, "settings": false}'::jsonb;

-- Create index for page_permissions
CREATE INDEX idx_client_users_page_permissions ON public.client_users USING GIN (page_permissions);

-- Helper function to check page permission
CREATE OR REPLACE FUNCTION public.check_page_permission(
  _user_id UUID,
  _client_id UUID,
  _page_name TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (page_permissions->_page_name)::boolean,
    false
  )
  FROM public.client_users
  WHERE user_id = _user_id 
    AND client_id = _client_id;
$$;

-- Helper function to get user departments
CREATE OR REPLACE FUNCTION public.get_user_departments(_client_id UUID)
RETURNS TABLE(id UUID, name TEXT, description TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description
  FROM public.departments
  WHERE client_id = _client_id
  ORDER BY name;
$$;

-- Update trigger for departments
CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policy for client_users to allow users with settings permission to manage other users
CREATE POLICY "Users with settings permission can manage client users"
ON public.client_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.client_id = client_users.client_id
    AND (cu.page_permissions->>'settings')::boolean = true
  )
);

-- Update RLS policy for client_settings to allow users with settings permission to update
CREATE POLICY "Users with settings permission can update client settings"
ON public.client_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
    AND cu.client_id = client_settings.client_id
    AND (cu.page_permissions->>'settings')::boolean = true
  )
);