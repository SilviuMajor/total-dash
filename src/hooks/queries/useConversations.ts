import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 30;

interface ConversationFilters {
  statuses?: string[];
}

export function useConversations(agentId: string | null, filters?: ConversationFilters) {
  const statuses = filters?.statuses ?? [];

  return useInfiniteQuery({
    queryKey: ['conversations', agentId, { statuses }],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId!)
        .eq('is_archived', false)
        .limit(PAGE_SIZE)
        .order('last_activity_at', { ascending: false });

      if (pageParam) {
        query = query.lt('last_activity_at', pageParam);
      }

      if (statuses.length > 0) {
        query = query.in('status', statuses);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (lastPage: any[]) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.last_activity_at;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!agentId,
    staleTime: 30_000,
  });
}
