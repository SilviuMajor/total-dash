-- Create analytics_tabs table for per-agent custom tabs
CREATE TABLE IF NOT EXISTS public.analytics_tabs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  default_date_range TEXT DEFAULT 'week',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, name)
);

-- Create analytics_cards table for metric cards within tabs
CREATE TABLE IF NOT EXISTS public.analytics_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id UUID NOT NULL REFERENCES public.analytics_tabs(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL, -- 'metric', 'chart', 'table'
  metric_type TEXT NOT NULL, -- 'total_conversations', 'avg_duration', 'conversations_by_status', etc.
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb, -- filters, display options, chart settings
  grid_position JSONB DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 4}'::jsonb,
  is_expanded BOOLEAN DEFAULT false, -- toggle between metric and chart view
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analytics_tabs
CREATE POLICY "Admins can manage all analytics tabs"
  ON public.analytics_tabs
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view tabs for their assigned agents"
  ON public.analytics_tabs
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

CREATE POLICY "Client users can manage tabs for their assigned agents"
  ON public.analytics_tabs
  FOR ALL
  USING (
    agent_id IN (
      SELECT aa.agent_id 
      FROM agent_assignments aa
      WHERE aa.client_id IN (
        SELECT client_id FROM get_user_client_ids(auth.uid())
      )
    )
  );

-- RLS Policies for analytics_cards
CREATE POLICY "Admins can manage all analytics cards"
  ON public.analytics_cards
  FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Client users can view cards for their agent tabs"
  ON public.analytics_cards
  FOR SELECT
  USING (
    tab_id IN (
      SELECT t.id FROM analytics_tabs t
      WHERE t.agent_id IN (
        SELECT aa.agent_id 
        FROM agent_assignments aa
        WHERE aa.client_id IN (
          SELECT client_id FROM get_user_client_ids(auth.uid())
        )
      )
    )
  );

CREATE POLICY "Client users can manage cards for their agent tabs"
  ON public.analytics_cards
  FOR ALL
  USING (
    tab_id IN (
      SELECT t.id FROM analytics_tabs t
      WHERE t.agent_id IN (
        SELECT aa.agent_id 
        FROM agent_assignments aa
        WHERE aa.client_id IN (
          SELECT client_id FROM get_user_client_ids(auth.uid())
        )
      )
    )
  );

-- Add triggers for updated_at
CREATE TRIGGER update_analytics_tabs_updated_at
  BEFORE UPDATE ON public.analytics_tabs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_cards_updated_at
  BEFORE UPDATE ON public.analytics_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for analytics tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_tabs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_cards;

-- Create index for faster queries
CREATE INDEX idx_analytics_tabs_agent_id ON public.analytics_tabs(agent_id);
CREATE INDEX idx_analytics_cards_tab_id ON public.analytics_cards(tab_id);