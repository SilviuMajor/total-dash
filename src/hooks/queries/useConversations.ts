import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 30;

interface ConversationFilters {
  status?: string;
}

export function useConversations(agentId: string | null, filters?: ConversationFilters) {
  const status = filters?.status ?? 'all';

  return useInfiniteQuery({
    queryKey: ['conversations', agentId, { status }],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId!)
        .limit(PAGE_SIZE)
        .order('last_activity_at', { ascending: false });

      if (pageParam) {
        query = query.lt('last_activity_at', pageParam);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
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
