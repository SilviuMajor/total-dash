import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('conversations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateConversationNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, metadata, note }: { id: string; metadata: any; note: string }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ metadata: { ...metadata, note } })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useToggleConversationTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      metadata,
      newTags,
    }: { id: string; metadata: any; newTags: string[] }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ metadata: { ...metadata, tags: newTags } })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => supabase.from('conversations').update({ status }).eq('id', id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBulkApplyTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      tagLabel,
      conversations,
    }: { ids: string[]; tagLabel: string; conversations: any[] }) => {
      await Promise.all(ids.map(id => {
        const conv = conversations.find(c => c.id === id);
        const currentTags: string[] = conv?.metadata?.tags || [];
        if (currentTags.includes(tagLabel)) return Promise.resolve();
        return supabase
          .from('conversations')
          .update({ metadata: { ...conv?.metadata, tags: [...currentTags, tagLabel] } })
          .eq('id', id);
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useBulkRemoveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      ids,
      tagLabel,
      conversations,
    }: { ids: string[]; tagLabel: string; conversations: any[] }) => {
      await Promise.all(ids.map(id => {
        const conv = conversations.find(c => c.id === id);
        const newTags = (conv?.metadata?.tags || []).filter((t: string) => t !== tagLabel);
        return supabase
          .from('conversations')
          .update({ metadata: { ...conv?.metadata, tags: newTags } })
          .eq('id', id);
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
