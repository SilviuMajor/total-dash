import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentConfig {
  custom_tracked_variables?: Array<{ voiceflow_name: string; display_name: string } | string>;
  widget_settings?: {
    functions?: {
      conversation_tags?: Array<{ id: string; label: string; color: string; enabled: boolean }>;
    };
  };
  auto_end_time?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: unknown;
}

export function useAgentConfig(agentId: string | null) {
  return useQuery({
    queryKey: ['agent-config', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('config')
        .eq('id', agentId!)
        .single();
      if (error) throw error;
      return (data?.config || {}) as AgentConfig;
    },
    enabled: !!agentId,
    staleTime: 5 * 60_000,
  });
}
