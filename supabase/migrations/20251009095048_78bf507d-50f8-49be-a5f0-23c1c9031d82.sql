-- Create integration_options table (global list of available integrations)
CREATE TABLE public.integration_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create agent_integrations table (which integrations each agent uses)
CREATE TABLE public.agent_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integration_options(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id, integration_id)
);

-- Enable RLS
ALTER TABLE public.integration_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for integration_options
CREATE POLICY "Admins can manage integration options"
ON public.integration_options
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view integration options"
ON public.integration_options
FOR SELECT
USING (true);

-- RLS Policies for agent_integrations
CREATE POLICY "Admins can manage agent integrations"
ON public.agent_integrations
FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view integrations for their agents"
ON public.agent_integrations
FOR SELECT
USING (
  agent_id IN (
    SELECT aa.agent_id
    FROM agent_assignments aa
    WHERE aa.client_id IN (
      SELECT client_id FROM get_user_client_ids(auth.uid())
    )
  )
);

-- Pre-populate premade integrations
INSERT INTO public.integration_options (name, icon, is_custom) VALUES
  ('CRM', 'Database', false),
  ('Ticketing', 'Ticket', false),
  ('Microsoft Teams', 'MessageSquare', false),
  ('Slack', 'Hash', false);

-- Create trigger for updated_at
CREATE TRIGGER update_integration_options_updated_at
BEFORE UPDATE ON public.integration_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_integrations_updated_at
BEFORE UPDATE ON public.agent_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();