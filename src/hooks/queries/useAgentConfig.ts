import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      return data?.config || {};
    },
    enabled: !!agentId,
    staleTime: 5 * 60_000,
  });
}
