-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Users with settings permission can manage client users" ON public.client_users;
DROP POLICY IF EXISTS "Users with settings permission can update client settings" ON public.client_settings;

-- Create a security definer function to check settings permission without recursion
CREATE OR REPLACE FUNCTION public.has_settings_permission(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (page_permissions->>'settings')::boolean,
    false
  )
  FROM public.client_users
  WHERE user_id = _user_id 
    AND client_id = _client_id;
$$;

-- Recreate the policies using the security definer function
CREATE POLICY "Users with settings permission can manage client users"
ON public.client_users
FOR ALL
USING (public.has_settings_permission(auth.uid(), client_users.client_id));

CREATE POLICY "Users with settings permission can update client settings"
ON public.client_settings
FOR UPDATE
USING (public.has_settings_permission(auth.uid(), client_settings.client_id));