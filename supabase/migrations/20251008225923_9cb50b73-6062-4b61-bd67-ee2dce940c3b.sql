-- Create agent status enum
CREATE TYPE public.agent_status AS ENUM ('active', 'testing', 'in_development');

-- Add status column to agents table
ALTER TABLE public.agents ADD COLUMN status public.agent_status NOT NULL DEFAULT 'active';

-- Create agent spec sections table
CREATE TABLE public.agent_spec_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB DEFAULT '{}'::jsonb,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create agent workflows table
CREATE TABLE public.agent_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create agent workflow categories table
CREATE TABLE public.agent_workflow_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create agent update logs table
CREATE TABLE public.agent_update_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on all new tables
ALTER TABLE public.agent_spec_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflow_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_update_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_spec_sections
CREATE POLICY "Admins can manage agent spec sections"
  ON public.agent_spec_sections
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view spec sections for their agents"
  ON public.agent_spec_sections
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

-- RLS Policies for agent_workflows
CREATE POLICY "Admins can manage agent workflows"
  ON public.agent_workflows
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view workflows for their agents"
  ON public.agent_workflows
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

-- RLS Policies for agent_workflow_categories
CREATE POLICY "Admins can manage workflow categories"
  ON public.agent_workflow_categories
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view workflow categories for their agents"
  ON public.agent_workflow_categories
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

-- RLS Policies for agent_update_logs
CREATE POLICY "Admins can manage update logs"
  ON public.agent_update_logs
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view update logs for their agents"
  ON public.agent_update_logs
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

-- Create triggers for updated_at
CREATE TRIGGER update_agent_spec_sections_updated_at
  BEFORE UPDATE ON public.agent_spec_sections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_workflows_updated_at
  BEFORE UPDATE ON public.agent_workflows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agent_workflow_categories_updated_at
  BEFORE UPDATE ON public.agent_workflow_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();