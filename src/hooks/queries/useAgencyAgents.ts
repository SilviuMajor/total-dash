import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAgencyAgents(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ['agency-agents', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('agency_id', agencyId!)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  });
}
