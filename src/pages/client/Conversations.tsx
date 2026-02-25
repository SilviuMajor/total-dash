import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ConversationsSkeleton } from "@/components/skeletons";
import { Phone, Clock, CheckCircle, MessageSquare, ArrowDown, ArrowUpDown, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { MetricCard } from "@/components/MetricCard";
import { MessageBubble } from "@/components/MessageBubble";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import debounce from "lodash.debounce";
import { useQueryClient } from "@tanstack/react-query";
import { useConversations } from "@/hooks/queries/useConversations";
import { useAgentConfig } from "@/hooks/queries/useAgentConfig";
import {
  useUpdateConversationNote,
  useToggleConversationTag,
  useUpdateConversationStatus,
  useBulkUpdateStatus,
  useBulkApplyTag,
  useBulkRemoveTag,
} from "@/hooks/queries/useConversationMutations";

interface Conversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  duration: number;
  is_widget_test?: boolean;
  metadata?: {
    variables?: {
      user_name?: string;
      user_email?: string;
      [key: string]: any;
    };
    note?: string;
    tags?: string[];
    [key: string]: any;
  };
}

interface Transcript {
  id: string;
  speaker: 'user' | 'assistant';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
  timestamp: string;
  metadata?: {
    button_click?: boolean;
    [key: string]: any;
  };
}

const PAGE_SIZE = 30;

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [note, setNote] = useState("");
  const [assignedTags, setAssignedTags] = useState<string[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc" | "duration">("desc");

  // Bulk select
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());

  const { selectedAgentId, agents } = useClientAgentContext();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // React Query hooks
  const {
    data: conversationsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useConversations(selectedAgentId, { status: statusFilter, sortOrder });

  const { data: agentConfig } = useAgentConfig(selectedAgentId);

  // Mutation hooks
  const updateNoteMutation = useUpdateConversationNote();
  const toggleTagMutation = useToggleConversationTag();
  const updateStatusMutation = useUpdateConversationStatus();
  const bulkUpdateStatusMutation = useBulkUpdateStatus();
  const bulkApplyTagMutation = useBulkApplyTag();
  const bulkRemoveTagMutation = useBulkRemoveTag();

  // Flatten pages
  const conversations: Conversation[] = useMemo(
    () => (conversationsData?.pages?.flat() || []) as Conversation[],
    [conversationsData]
  );

  // Debounce search
  const debouncedSetSearch = useRef(
    debounce((val: string) => setDebouncedSearch(val), 300)
  ).current;

  useEffect(() => {
    debouncedSetSearch(searchQuery);
  }, [searchQuery]);

  // Reset selection on filter/agent change
  useEffect(() => {
    setSelectedConversationIds(new Set());
  }, [selectedAgentId, statusFilter, tagFilters, sortOrder]);

  // Auto-select conversation from ?conversationId query param
  useEffect(() => {
    const convId = searchParams.get('conversationId');
    if (!convId || conversations.length === 0) return;
    const match = conversations.find(c => c.id === convId);
    if (match) {
      setSelectedConversation(match);
      setSearchParams({}, { replace: true });
    }
  }, [conversations, searchParams]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (selectedConversation?.id) {
      loadTranscripts(selectedConversation.id);
      setNote(selectedConversation.metadata?.note || "");
      setAssignedTags(selectedConversation.metadata?.tags || []);
      setShowJumpToLatest(false);
      setTimeout(() => {
        if (transcriptScrollRef.current) {
          transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [selectedConversation?.id]);

  // Real-time subscriptions for conversations
  useEffect(() => {
    if (!selectedAgentId) return;

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `agent_id=eq.${selectedAgentId}`
        },
        (payload) => {
          const queryKey = ['conversations', selectedAgentId, { status: statusFilter, sortOrder }];
          if (payload.eventType === 'INSERT') {
            queryClient.setQueryData(queryKey, (old: any) => {
              if (!old) return old;
              const firstPage = [payload.new as Conversation, ...(old.pages[0] || [])];
              return { ...old, pages: [firstPage, ...old.pages.slice(1)] };
            });
          } else if (payload.eventType === 'DELETE') {
            queryClient.setQueryData(queryKey, (old: any) => {
              if (!old) return old;
              return { ...old, pages: old.pages.map((page: any[]) => page.filter(c => c.id !== (payload.old as any).id)) };
            });
          } else if (payload.eventType === 'UPDATE') {
            queryClient.setQueryData(queryKey, (old: any) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((page: any[]) =>
                  page.map(c => c.id === (payload.new as any).id ? payload.new as Conversation : c)
                )
              };
            });
            if (selectedConversation?.id === (payload.new as any).id) {
              setSelectedConversation(payload.new as Conversation);
            }
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [selectedAgentId, selectedConversation?.id, statusFilter, sortOrder, queryClient]);

  // Real-time subscriptions for transcripts
  useEffect(() => {
    if (!selectedConversation?.id) return;

    const transcriptChannel = supabase
      .channel('transcripts-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          setTranscripts(prev => [...prev, payload.new as Transcript]);
        }
      )
      .subscribe();

    return () => { transcriptChannel.unsubscribe(); };
  }, [selectedConversation?.id]);

  const loadTranscripts = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select('id, speaker, text, buttons, timestamp, metadata')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true });
      if (error) throw error;
      setTranscripts((data || []) as Transcript[]);
    } catch (error) {
      console.error('Error loading transcripts:', error);
    }
  };

  const saveNote = async () => {
    if (!selectedConversation) return;
    setSavingNote(true);
    try {
      await updateNoteMutation.mutateAsync({
        id: selectedConversation.id,
        metadata: selectedConversation.metadata,
        note,
      });
      toast({ title: "Success", description: "Note saved successfully" });
      setSelectedConversation(prev => prev ? { ...prev, metadata: { ...prev.metadata, note } } : null);
    } catch {
      toast({ title: "Error", description: "Failed to save note", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const toggleTag = async (tagLabel: string) => {
    if (!selectedConversation || updatingTags) return;
    const newTags = assignedTags.includes(tagLabel)
      ? assignedTags.filter(t => t !== tagLabel)
      : [...assignedTags, tagLabel];
    setUpdatingTags(true);
    try {
      await toggleTagMutation.mutateAsync({
        id: selectedConversation.id,
        metadata: selectedConversation.metadata,
        newTags,
      });
      setAssignedTags(newTags);
      setSelectedConversation(prev => prev ? { ...prev, metadata: { ...prev.metadata, tags: newTags } } : null);
    } catch {
      toast({ title: "Error", description: "Failed to update tags", variant: "destructive" });
    } finally {
      setUpdatingTags(false);
    }
  };

  const handleTranscriptScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowJumpToLatest(!isNearBottom);
  };

  const jumpToLatest = () => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTo({ top: transcriptScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
    setShowJumpToLatest(false);
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedConversation || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updateStatusMutation.mutateAsync({ id: selectedConversation.id, status: newStatus });
      toast({ title: "Success", description: `Status updated to ${newStatus}` });
      setSelectedConversation(prev => prev ? { ...prev, status: newStatus } : null);
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Bulk actions
  const bulkUpdateStatus = async (newStatus: string) => {
    const ids = Array.from(selectedConversationIds);
    await bulkUpdateStatusMutation.mutateAsync({ ids, status: newStatus });
    toast({ title: "Success", description: `Updated ${ids.length} conversation${ids.length !== 1 ? 's' : ''}` });
    setSelectedConversationIds(new Set());
  };

  const bulkApplyTag = async (tagLabel: string) => {
    const ids = Array.from(selectedConversationIds);
    await bulkApplyTagMutation.mutateAsync({ ids, tagLabel, conversations });
    toast({ title: "Success", description: `Tagged ${ids.length} conversation${ids.length !== 1 ? 's' : ''}` });
    setSelectedConversationIds(new Set());
  };

  const bulkRemoveTag = async (tagLabel: string) => {
    const ids = Array.from(selectedConversationIds);
    await bulkRemoveTagMutation.mutateAsync({ ids, tagLabel, conversations });
    toast({ title: "Success", description: `Removed tag from ${ids.length} conversation${ids.length !== 1 ? 's' : ''}` });
    setSelectedConversationIds(new Set());
  };

  const toggleTagFilter = (label: string) => {
    setTagFilters(prev =>
      prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]
    );
  };

  const availableTags = (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.filter((t: any) => t.enabled) || [];

  // Client-side search + tag filtering
  const filteredConversations = useMemo(() => {
    let result = conversations;
    const q = debouncedSearch.toLowerCase();
    if (q) {
      result = result.filter(c =>
        c.caller_phone?.toLowerCase().includes(q) ||
        c.metadata?.variables?.user_name?.toLowerCase().includes(q) ||
        c.metadata?.variables?.user_email?.toLowerCase().includes(q)
      );
    }
    if (tagFilters.length > 0) {
      result = result.filter(c =>
        tagFilters.some(tag => c.metadata?.tags?.includes(tag))
      );
    }
    return result;
  }, [conversations, debouncedSearch, tagFilters]);

  const allSelected = filteredConversations.length > 0 &&
    filteredConversations.every(c => selectedConversationIds.has(c.id));

  const sortLabel = sortOrder === 'asc' ? 'Oldest first' : sortOrder === 'duration' ? 'Longest' : 'Newest first';

  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Conversations</h1>
            <p className="text-muted-foreground">Review and manage your agent conversations</p>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Card className="h-full overflow-hidden">
          <div className="grid grid-cols-12 h-full">

            {/* Left Panel: Conversation List */}
            <div className="col-span-3 flex flex-col border-r border-border h-full overflow-hidden">

              {/* Bulk Actions Toolbar */}
              {selectedConversationIds.size > 0 && (
                <div className="p-2 bg-muted border-b border-border flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-medium text-foreground mr-1">
                    {selectedConversationIds.size} selected
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSelectedConversationIds(new Set())}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs px-2">Status</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => bulkUpdateStatus('active')}>
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => bulkUpdateStatus('owned')}>
                        <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />Owned
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => bulkUpdateStatus('resolved')}>
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />Resolved
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {availableTags.length > 0 && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2">+ Tag</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {availableTags.map((tag: any) => (
                            <DropdownMenuItem key={tag.id} onClick={() => bulkApplyTag(tag.label)}>
                              <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: tag.color }} />
                              {tag.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2">− Tag</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {availableTags.map((tag: any) => (
                            <DropdownMenuItem key={tag.id} onClick={() => bulkRemoveTag(tag.label)}>
                              <span className="w-2 h-2 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: tag.color }} />
                              {tag.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              )}

              {/* Search + Sort */}
              <div className="p-3 border-b border-border flex gap-2">
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 px-2.5 shrink-0" title={sortLabel}>
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSortOrder('desc')}>
                      {sortOrder === 'desc' && <span className="mr-1">✓</span>}Newest first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder('asc')}>
                      {sortOrder === 'asc' && <span className="mr-1">✓</span>}Oldest first
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOrder('duration')}>
                      {sortOrder === 'duration' && <span className="mr-1">✓</span>}Longest duration
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Status filters + Select All */}
              <div className="px-3 py-2 border-b border-border space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedConversationIds(new Set(filteredConversations.map(c => c.id)));
                      } else {
                        setSelectedConversationIds(new Set());
                      }
                    }}
                    className="mr-1"
                  />
                  {(['all', 'active', 'owned', 'resolved'] as const).map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={statusFilter === s ? 'default' : 'outline'}
                      onClick={() => setStatusFilter(s)}
                      className="h-7 text-xs rounded-full px-3"
                    >
                      {s !== 'all' && (
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full mr-1",
                          s === 'active' && 'bg-green-400',
                          s === 'owned' && 'bg-yellow-400',
                          s === 'resolved' && 'bg-blue-400'
                        )} />
                      )}
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>

                {availableTags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {availableTags.map((tag: any) => (
                      <Badge
                        key={tag.id}
                        variant={tagFilters.includes(tag.label) ? 'default' : 'outline'}
                        className="cursor-pointer text-xs"
                        onClick={() => toggleTagFilter(tag.label)}
                        style={tagFilters.includes(tag.label) ? {
                          backgroundColor: tag.color,
                          borderColor: tag.color,
                          color: '#ffffff'
                        } : {
                          borderColor: tag.color,
                          color: tag.color,
                          backgroundColor: 'transparent'
                        }}
                      >
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Conversation list */}
              <ScrollArea className="flex-1">
                <div className="space-y-1 p-2">
                  {isLoading ? (
                    <ConversationsSkeleton />
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-12 px-4">
                      <p className="text-muted-foreground font-medium">No conversations yet</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Conversations will appear here once your chatbot starts receiving messages.
                      </p>
                    </div>
                  ) : (
                    filteredConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={cn(
                          "flex items-start gap-2 p-3 rounded-lg hover:bg-muted transition-colors",
                          selectedConversation?.id === conv.id && "bg-muted"
                        )}
                      >
                        <Checkbox
                          checked={selectedConversationIds.has(conv.id)}
                          onCheckedChange={(checked) => {
                            setSelectedConversationIds(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(conv.id); else next.delete(conv.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-0.5 shrink-0"
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedConversation(conv)}
                        >
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {conv.metadata?.variables?.user_name || conv.caller_phone || 'Unknown'}
                            </p>
                            {conv.is_widget_test && (
                              <Badge variant="outline" className="text-xs shrink-0">🧪 Test</Badge>
                            )}
                            <Badge
                              variant={conv.status === 'active' ? 'default' : 'secondary'}
                              className={cn(
                                "text-xs shrink-0",
                                conv.status === 'owned' && "bg-yellow-500 text-white hover:bg-yellow-600"
                              )}
                            >
                              {conv.status === 'owned' ? 'Owned' : conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                            </Badge>
                            {conv.metadata?.tags?.map((tag: string) => {
                              const tagConfig = (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.find(
                                (t: any) => t.label === tag
                              );
                              return tagConfig ? (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="text-xs shrink-0"
                                  style={{
                                    backgroundColor: `${tagConfig.color}20`,
                                    borderColor: tagConfig.color,
                                    color: tagConfig.color
                                  }}
                                >
                                  {tag}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(conv.started_at))} ago
                          </p>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Loading more spinner */}
                  {isFetchingNextPage && (
                    <div className="flex justify-center py-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                    </div>
                  )}

                  {/* Sentinel for IntersectionObserver */}
                  <div ref={sentinelRef} className="h-1" />
                </div>
              </ScrollArea>
            </div>

            {/* Middle Panel: Transcript */}
            <div className="col-span-6 flex flex-col border-r border-border h-full overflow-hidden relative">
              {selectedConversation ? (
                <>
                  <div className="p-4 border-b border-border">
                    <h3 className="font-semibold text-lg">
                      {selectedConversation.metadata?.variables?.user_name || selectedConversation.caller_phone || 'Unknown'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Started {format(new Date(selectedConversation.started_at), 'PPp')}
                    </p>
                  </div>
                  <ScrollArea
                    className="flex-1 min-h-0"
                    viewportRef={transcriptScrollRef}
                    onViewportScroll={handleTranscriptScroll}
                  >
                    <div className="p-4">
                      {transcripts.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          No transcript available for this conversation.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {transcripts.map((transcript, index) => {
                            const speaker = (transcript.speaker.toLowerCase().includes('user') ||
                              transcript.speaker.toLowerCase().includes('caller')) ? 'user' : 'assistant';
                            return (
                              <MessageBubble
                                key={transcript.id || index}
                                text={transcript.text}
                                speaker={speaker}
                                timestamp={transcript.timestamp}
                                buttons={transcript.buttons}
                                appearance={{
                                  primaryColor: '#3b82f6',
                                  secondaryColor: '#ffffff',
                                  textColor: '#1f2937',
                                  messageTextColor: '#1f2937',
                                  messageBgColor: '#f3f4f6',
                                  fontSize: 14,
                                  messageBubbleStyle: 'rounded',
                                }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {showJumpToLatest && (
                    <Button
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg z-10"
                      size="sm"
                      onClick={jumpToLatest}
                    >
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Jump to latest
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  Select a conversation to view details
                </div>
              )}
            </div>

            {/* Right Panel: Details */}
            <div className="col-span-3 flex flex-col h-full">
              <ScrollArea className="flex-1">
                <div className="p-6 space-y-4">
                  {selectedConversation ? (
                    <>
                      {selectedConversation?.metadata?.variables &&
                        Object.keys(selectedConversation.metadata.variables).length > 0 && (
                          <div>
                            <Label className="mb-3 block font-semibold">Captured Information</Label>
                            <div className="space-y-2 p-3 bg-muted rounded-lg">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Name:</span>
                                  <span className={`font-medium ${!selectedConversation.metadata.variables.user_name ? 'text-muted-foreground italic' : ''}`}>
                                    {selectedConversation.metadata.variables.user_name || 'Not captured yet'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">Email:</span>
                                  <span className={`font-medium ${!selectedConversation.metadata.variables.user_email ? 'text-muted-foreground italic' : ''}`}>
                                    {selectedConversation.metadata.variables.user_email || 'Not captured yet'}
                                  </span>
                                </div>
                                {(agentConfig as any)?.custom_tracked_variables?.map((variable: any) => {
                                  const voiceflowName = typeof variable === 'string' ? variable : variable.voiceflow_name;
                                  const displayName = typeof variable === 'string'
                                    ? variable.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
                                    : variable.display_name;
                                  return (
                                    <div key={voiceflowName} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">{displayName}:</span>
                                      <span className={`font-medium ${!selectedConversation.metadata?.variables?.[voiceflowName] ? 'text-muted-foreground italic' : ''}`}>
                                        {selectedConversation.metadata?.variables?.[voiceflowName] || 'Not captured yet'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                      <div>
                        <Label className="mb-2 block">Status</Label>
                        <Select
                          value={selectedConversation?.status || 'active'}
                          onValueChange={updateStatus}
                          disabled={updatingStatus}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span>Active</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="owned">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span>Owned</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="resolved">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>Resolved</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="mb-2 block">Tags</Label>
                        <div className="flex flex-wrap gap-2">
                          {(agentConfig as any)?.widget_settings?.functions?.conversation_tags
                            ?.filter((tag: any) => tag.enabled)
                            .map((tag: any) => {
                              const isAssigned = assignedTags.includes(tag.label);
                              return (
                                <Button
                                  key={tag.id}
                                  size="sm"
                                  variant={isAssigned ? "default" : "outline"}
                                  onClick={() => toggleTag(tag.label)}
                                  disabled={updatingTags}
                                  style={isAssigned ? {
                                    backgroundColor: tag.color,
                                    borderColor: tag.color,
                                    color: '#ffffff'
                                  } : {
                                    borderColor: tag.color,
                                    color: tag.color,
                                    backgroundColor: 'transparent'
                                  }}
                                >
                                  {tag.label}
                                </Button>
                              );
                            })}
                          {(!(agentConfig as any)?.widget_settings?.functions?.conversation_tags?.length) && (
                            <p className="text-sm text-muted-foreground">No tags configured</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="note" className="mb-2 block">Note</Label>
                        <Textarea
                          id="note"
                          placeholder="Add a note about this conversation..."
                          className="min-h-[100px]"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <Button
                          size="sm"
                          className="mt-2 w-full"
                          onClick={saveNote}
                          disabled={savingNote}
                        >
                          {savingNote ? "Saving..." : "Save Note"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted-foreground text-sm">
                      Select a conversation to view options
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
