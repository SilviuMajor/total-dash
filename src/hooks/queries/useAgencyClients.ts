import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAgencyClients(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: ['agency-clients', agencyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('agency_id', agencyId!)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  });
}

export function useClientAgents(agencyId: string | null | undefined, clientIds: string[]) {
  return useQuery({
    queryKey: ['client-agents', agencyId, clientIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_assignments')
        .select('client_id, agents(name, provider)')
        .in('client_id', clientIds);
      if (error) throw error;

      return (data || []).reduce((acc: Record<string, Array<{ name: string; provider: string }>>, item: any) => {
        if (!acc[item.client_id]) acc[item.client_id] = [];
        if (item.agents) {
          acc[item.client_id].push({ name: item.agents.name, provider: item.agents.provider });
        }
        return acc;
      }, {});
    },
    enabled: !!agencyId && clientIds.length > 0,
    staleTime: 60_000,
  });
}

export function useClientUserCounts(clientIds: string[]) {
  return useQuery({
    queryKey: ['client-user-counts', clientIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_users')
        .select('client_id')
        .in('client_id', clientIds);
      if (error) throw error;

      return (data || []).reduce((acc: Record<string, number>, item: any) => {
        acc[item.client_id] = (acc[item.client_id] || 0) + 1;
        return acc;
      }, {});
    },
    enabled: clientIds.length > 0,
    staleTime: 60_000,
  });
}
