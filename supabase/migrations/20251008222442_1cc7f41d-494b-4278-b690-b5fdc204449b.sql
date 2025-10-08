-- Create agent_types table for managing agent type settings
CREATE TABLE public.agent_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  function_name TEXT NOT NULL DEFAULT 'Assistant',
  function_type TEXT NOT NULL DEFAULT 'Voice Agent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.agent_types ENABLE ROW LEVEL SECURITY;

-- Admins can manage agent types
CREATE POLICY "Admins can manage agent types"
ON public.agent_types
FOR ALL
USING (is_admin(auth.uid()));

-- Client users can view agent types
CREATE POLICY "Client users can view agent types"
ON public.agent_types
FOR SELECT
USING (true);

-- Insert default agent types
INSERT INTO public.agent_types (provider, function_name, function_type)
VALUES 
  ('voiceflow', 'Assistant', 'Voice Agent'),
  ('retell', 'Assistant', 'Voice Agent');

-- Add trigger for updated_at
CREATE TRIGGER update_agent_types_updated_at
  BEFORE UPDATE ON public.agent_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();