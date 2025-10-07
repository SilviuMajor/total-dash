-- Create client_user_agent_permissions table
CREATE TABLE public.client_user_agent_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  permissions JSONB NOT NULL DEFAULT '{"analytics": true, "conversations": true, "knowledge_base": false, "agent_settings": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.client_user_agent_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all agent permissions"
ON public.client_user_agent_permissions
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own agent permissions"
ON public.client_user_agent_permissions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users with settings permission can manage agent permissions"
ON public.client_user_agent_permissions
FOR ALL
USING (has_settings_permission(auth.uid(), client_id));

-- Create trigger for updated_at
CREATE TRIGGER update_client_user_agent_permissions_updated_at
BEFORE UPDATE ON public.client_user_agent_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing data from client_users to client_user_agent_permissions
INSERT INTO public.client_user_agent_permissions (user_id, agent_id, client_id, permissions)
SELECT 
  cu.user_id,
  aa.agent_id,
  cu.client_id,
  jsonb_build_object(
    'analytics', COALESCE((cu.page_permissions->>'analytics')::boolean, true),
    'conversations', COALESCE((cu.page_permissions->>'dashboard')::boolean, true),
    'knowledge_base', false,
    'agent_settings', COALESCE((cu.page_permissions->>'settings')::boolean, false)
  ) as permissions
FROM public.client_users cu
CROSS JOIN public.agent_assignments aa
WHERE aa.client_id = cu.client_id;