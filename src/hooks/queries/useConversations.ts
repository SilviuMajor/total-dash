import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 30;

interface ConversationFilters {
  status?: string;
  sortOrder?: 'desc' | 'asc' | 'duration';
}

export function useConversations(agentId: string | null, filters?: ConversationFilters) {
  const status = filters?.status ?? 'all';
  const sortOrder = filters?.sortOrder ?? 'desc';

  return useInfiniteQuery({
    queryKey: ['conversations', agentId, { status, sortOrder }],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('agent_id', agentId!)
        .limit(PAGE_SIZE);

      if (sortOrder === 'duration') {
        query = query.order('duration', { ascending: false });
      } else {
        query = query.order('started_at', { ascending: sortOrder === 'asc' });
        if (pageParam) {
          if (sortOrder === 'asc') {
            query = query.gt('started_at', pageParam);
          } else {
            query = query.lt('started_at', pageParam);
          }
        }
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as any[];
    },
    getNextPageParam: (lastPage: any[]) => {
      if (sortOrder === 'duration') return undefined;
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1]?.started_at;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!agentId,
    staleTime: 30_000,
  });
}
