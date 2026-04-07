import { useEffect, useState, useRef, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ConversationsSkeleton } from "@/components/skeletons";
import { Phone, Clock, CheckCircle, MessageSquare, ArrowDown, X, Plus, Tag, Users, Building2, Send, UserCheck, PhoneOff, ArrowRightLeft, Lock, Loader2, AlertTriangle, Timer, MessageSquareText, Trash2, FolderOpen, Sparkles, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { NoAgentsAssigned } from "@/components/NoAgentsAssigned";
import { ClientAgentSelector } from "@/components/ClientAgentSelector";
import { MetricCard } from "@/components/MetricCard";
import { MessageBubble } from "@/components/MessageBubble";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
import { useAuth } from "@/hooks/useAuth";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { getSoundPreferences, playHandoverRequestSound, playNewMessageSound, sendBrowserNotification } from "@/lib/notificationSounds";

interface Conversation {
  id: string;
  caller_phone: string;
  status: string;
  started_at: string;
  duration: number;
  is_widget_test?: boolean;
  owner_id?: string;
  owner_name?: string;
  department_id?: string;
  voiceflow_user_id?: string;
  last_customer_message_at?: string;
  first_unanswered_message_at?: string;
  last_activity_at?: string;
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
  resolution_reason?: string;
  resolution_note?: string;
}

interface Transcript {
  id: string;
  speaker: 'user' | 'assistant' | 'client_user' | 'system';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
  timestamp: string;
  metadata?: {
    button_click?: boolean;
    client_user_id?: string;
    client_user_name?: string;
    type?: string;
    [key: string]: any;
  };
}

const PAGE_SIZE = 30;

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [note, setNote] = useState("");
  const [assignedTags, setAssignedTags] = useState<string[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>([]);
  

  // Bulk select
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());

  const { selectedAgentId, agents, clientId } = useClientAgentContext();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { isClientPreviewMode, previewClient } = useMultiTenantAuth();

  // Handover state
  const [chatMessage, setChatMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [handoverLoading, setHandoverLoading] = useState<string | null>(null);
  const [endHandoverOpen, setEndHandoverOpen] = useState(false);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveAction, setResolveAction] = useState<'end_handover' | 'mark_resolved'>('end_handover');
  const [resolveReason, setResolveReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferNote, setTransferNote] = useState("");
  const [transferDeptId, setTransferDeptId] = useState("");
  const [takeoverConfirmOpen, setTakeoverConfirmOpen] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; code: string | null; color: string | null }>>([]);
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [handoverHistory, setHandoverHistory] = useState<any[]>([]);
  
  const [currentClientUserId, setCurrentClientUserId] = useState<string | null>(null);
  const [pendingConversationIds, setPendingConversationIds] = useState<Map<string, string>>(new Map());
  const [responseTick, setResponseTick] = useState(0);

  // Previous conversations
  const [previousConversations, setPreviousConversations] = useState<Conversation[]>([]);
  const [showAllPreviousConversations, setShowAllPreviousConversations] = useState(false);
  const [showPreviousConversations, setShowPreviousConversations] = useState(true);
  const [showAllHandoverHistory, setShowAllHandoverHistory] = useState(false);

  // Canned responses state
  const [showCannedDropdown, setShowCannedDropdown] = useState(false);
  const [cannedTab, setCannedTab] = useState<'org' | 'personal'>('org');
  const [orgResponses, setOrgResponses] = useState<any[]>([]);
  const [personalResponses, setPersonalResponses] = useState<any[]>([]);
  const [personalEnabled, setPersonalEnabled] = useState(true);
  const [addingPersonal, setAddingPersonal] = useState(false);
  const [newPersonalTitle, setNewPersonalTitle] = useState("");
  const [newPersonalBody, setNewPersonalBody] = useState("");
  const [newPersonalCategory, setNewPersonalCategory] = useState("General");

  // AI enhance state
  const [aiEnhanceOpen, setAiEnhanceOpen] = useState(false);
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiEnhancedText, setAiEnhancedText] = useState("");
  const [aiEnhanceMode, setAiEnhanceMode] = useState<string | null>(null);

  const selectedConversationRef = useRef(selectedConversation);

  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);

  const {
    data: conversationsData,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useConversations(selectedAgentId, { statuses: statusFilters });

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

  // Reset selection on filter/agent change
  useEffect(() => {
    setSelectedConversationIds(new Set());
  }, [selectedAgentId, statusFilters, tagFilters, departmentFilters]);

  // Response time tick (every second for live updates)
  useEffect(() => {
    const interval = setInterval(() => setResponseTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load canned responses when agent changes
  useEffect(() => {
    const loadCanned = async () => {
      if (!clientId) return;
      
      // Load org responses
      const { data: org } = await supabase
        .from("canned_responses")
        .select("*")
        .eq("client_id", clientId)
        .order("category")
        .order("sort_order");
      setOrgResponses(org || []);
      
      // Load personal responses
      if (user?.id) {
        const { data: personal } = await supabase
          .from("canned_responses")
          .select("*")
          .eq("user_id", user.id)
          .is("agent_id", null)
          .order("category")
          .order("sort_order");
        setPersonalResponses(personal || []);
      }
      
      // Check if personal is enabled
      const agent = agents.find(a => a.id === selectedAgentId);
      const agentConfig = (agent as any)?.config;
      setPersonalEnabled(agentConfig?.canned_responses_personal_enabled !== false);
    };
    loadCanned();
  }, [clientId, selectedAgentId, user?.id]);


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
          const queryKey = ['conversations', selectedAgentId, { statuses: statusFilters }];
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
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime subscription error, will retry automatically');
        }
      });

    return () => { channel.unsubscribe(); };
  }, [selectedAgentId, selectedConversation?.id, statusFilters, queryClient]);

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
          const newTranscript = payload.new as Transcript;
          setTranscripts(prev => {
            // Deduplicate — don't add if we already have this transcript ID
            if (prev.some(t => t.id === newTranscript.id)) return prev;
            return [...prev, newTranscript];
          });
          // Play sound for handover request
          if (newTranscript.metadata && (newTranscript.metadata as any).type === 'handover_requested') {
            const prefs = getSoundPreferences();
            if (prefs.handoverRequestEnabled) {
              playHandoverRequestSound(prefs.handoverRequestVolume);
            }
          }
          // Customer message sounds are handled by the global my-handover-messages subscription
          // Auto-scroll after React re-renders the new message
          setTimeout(() => {
            if (transcriptScrollRef.current) {
              transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
            }
          }, 300);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime subscription error, will retry automatically');
        }
      });

    const conversationChannel = supabase
      .channel('conversation-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${selectedConversation.id}`
        },
        async (payload) => {
          const updated = payload.new as any;
          setSelectedConversation(prev => prev ? { ...prev, ...updated } : prev);
          // Refresh handover sessions
          const { data: pending } = await supabase
            .from('handover_sessions')
            .select('*, departments:department_id(name, code, color, timeout_seconds)')
            .eq('conversation_id', selectedConversation.id)
            .eq('status', 'pending')
            .maybeSingle();
          setPendingSession(pending);
          const { data: active } = await supabase
            .from('handover_sessions')
            .select('*, departments:department_id(name, code, color)')
            .eq('conversation_id', selectedConversation.id)
            .eq('status', 'active')
            .maybeSingle();
          setActiveSession(active);
          // Refresh the conversations list
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => { 
      transcriptChannel.unsubscribe(); 
      conversationChannel.unsubscribe();
    };
  }, [selectedConversation?.id, queryClient]);

  // Load current client user ID (handles both real client and preview mode)
  useEffect(() => {
    const loadClientUser = async () => {
      if (!user?.id) return;

      // First try: direct lookup in client_users
      const { data: directMatch } = await supabase
        .from('client_users')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (directMatch) {
        setCurrentClientUserId(directMatch.id);
        console.log('[Handover] Client user ID (direct):', directMatch.id);
        return;
      }

      // Preview mode fallback: find the first client_user for the preview client
      // This lets agency admins test handover actions when previewing
      if (isClientPreviewMode && previewClient?.id) {
        const { data: previewUser } = await supabase
          .from('client_users')
          .select('id')
          .eq('client_id', previewClient.id)
          .limit(1)
          .maybeSingle();
        
        if (previewUser) {
          setCurrentClientUserId(previewUser.id);
          console.log('[Handover] Client user ID (preview fallback):', previewUser.id);
          return;
        }
      }

      console.warn('No client user ID found for current user');
    };
    loadClientUser();
  }, [user?.id, isClientPreviewMode, previewClient]);

  // Load pending handover conversation IDs for pinning
  useEffect(() => {
    const loadPendingIds = async () => {
      if (!selectedAgentId) return;
      const { data } = await supabase
        .from('handover_sessions')
        .select('conversation_id, created_at')
        .eq('status', 'pending');
      if (data) {
        setPendingConversationIds(new Map(data.map(d => [d.conversation_id, d.created_at])));
      }
    };
    loadPendingIds();

    const channel = supabase
      .channel('pending-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handover_sessions' }, () => {
        loadPendingIds();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [selectedAgentId]);

  // Play sound for NEW pending handover sessions across all conversations
  useEffect(() => {
    const pendingChannel = supabase
      .channel('new-handover-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'handover_sessions',
          filter: 'status=eq.pending'
        },
        () => {
          const prefs = getSoundPreferences();
          if (prefs.handoverRequestEnabled) {
            playHandoverRequestSound(prefs.handoverRequestVolume);
          }
          if (prefs.browserNotifications) {
            sendBrowserNotification("New Handover Request", "A customer is requesting to speak with an agent");
          }
        }
      )
      .subscribe();

    return () => { pendingChannel.unsubscribe(); };
  }, []);

  // Sound notification for customer messages in ANY of my active handovers
  useEffect(() => {
    if (!currentClientUserId) return;

    const messageChannel = supabase
      .channel('my-handover-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transcripts',
        },
        async (payload) => {
          const transcript = payload.new as any;
          if (transcript.speaker !== 'user') return;

          // Check if this conversation has an active handover owned by me
          const { data: session } = await supabase
            .from('handover_sessions')
            .select('id')
            .eq('conversation_id', transcript.conversation_id)
            .eq('status', 'active')
            .eq('client_user_id', currentClientUserId)
            .maybeSingle();

          if (session) {
            const prefs = getSoundPreferences();
            if (prefs.newMessageEnabled) {
              playNewMessageSound(prefs.newMessageVolume);
            }
            if (prefs.browserNotifications) {
              sendBrowserNotification("New Customer Message", "A customer sent a message in your handover");
            }
          }
        }
      )
      .subscribe();

    return () => { messageChannel.unsubscribe(); };
  }, [currentClientUserId]);

  useEffect(() => {
    const loadDepts = async () => {
      const effectiveClientId = clientId || (isClientPreviewMode && previewClient?.id ? previewClient.id : null);
      if (!effectiveClientId) return;
      const { data } = await supabase
        .from('departments')
        .select('id, name, code, color, is_global')
        .eq('client_id', effectiveClientId)
        .is('deleted_at', null)
        .order('is_global', { ascending: false })
        .order('name');
      if (data) setDepartments(data);
    };
    loadDepts();
  }, [clientId, isClientPreviewMode, previewClient]);

  // Load handover sessions when conversation selected or status changes
  useEffect(() => {
    const loadSessions = async () => {
      if (!selectedConversation?.id) {
        setPendingSession(null);
        setActiveSession(null);
        setHandoverHistory([]);
        return;
      }

      const { data: pending, error: pendingError } = await supabase
        .from('handover_sessions')
        .select('*, departments:department_id(name, code, color, timeout_seconds)')
        .eq('conversation_id', selectedConversation.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingError) {
        console.error('[Handover] Error loading pending session:', pendingError);
      }
      console.log('[Handover] Pending session for', selectedConversation.id, ':', pending);
      setPendingSession(pending);

      const { data: active, error: activeError } = await supabase
        .from('handover_sessions')
        .select('*, departments:department_id(name, code, color)')
        .eq('conversation_id', selectedConversation.id)
        .eq('status', 'active')
        .maybeSingle();

      if (activeError) {
        console.error('[Handover] Error loading active session:', activeError);
      }
      setActiveSession(active);

      // Load completed handover sessions for history
      const { data: history } = await supabase
        .from('handover_sessions')
        .select('*, departments:department_id(name, color)')
        .eq('conversation_id', selectedConversation.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });
      setHandoverHistory(history || []);
    };
    loadSessions();

    // Subscribe to session changes for the selected conversation
    if (selectedConversation?.id) {
      const sessionChannel = supabase
        .channel(`session-${selectedConversation.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'handover_sessions',
          filter: `conversation_id=eq.${selectedConversation.id}`
        }, () => {
          loadSessions();
        })
        .subscribe();

      return () => { sessionChannel.unsubscribe(); };
    }
  }, [selectedConversation?.id, selectedConversation?.status]);

  // Load previous conversations for the same customer
  useEffect(() => {
    const loadPreviousConversations = async () => {
      if (!selectedConversation?.voiceflow_user_id || !selectedConversation?.id) {
        setPreviousConversations([]);
        setShowAllPreviousConversations(false);
        return;
      }

      // Link by customer_base_id (persistent across sessions) if available, fall back to voiceflow_user_id
      const linkId = (selectedConversation as any).customer_base_id || selectedConversation.voiceflow_user_id;
      const linkField = (selectedConversation as any).customer_base_id ? 'customer_base_id' : 'voiceflow_user_id';
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq(linkField, linkId)
        .neq('id', selectedConversation.id)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading previous conversations:', error);
        setPreviousConversations([]);
      } else {
        setPreviousConversations((data || []) as unknown as Conversation[]);
      }
    };
    loadPreviousConversations();
    setShowAllPreviousConversations(false);
  }, [selectedConversation?.id]);

  // Periodic handover timer check
  useEffect(() => {
    const runTimer = async () => {
      try {
        console.log('[Timer] Running handover timer check...');
        const { data, error } = await supabase.functions.invoke('handover-timer', { body: {} });
        if (error) {
          console.error('[Timer] Error invoking handover-timer:', error);
        } else {
          console.log('[Timer] Result:', data);
        }
      } catch (e) {
        console.error('[Timer] Exception:', e);
      }
    };

    runTimer();
    const timerInterval = setInterval(runTimer, 30000); // Every 30 seconds for testing
    return () => clearInterval(timerInterval);
  }, []);

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

  // === Handover action helper ===
  const callHandoverAction = async (actionName: string, extraBody: Record<string, any> = {}) => {
    setHandoverLoading(actionName);
    try {
      const { data, error } = await supabase.functions.invoke('handover-actions', {
        body: {
          action: actionName,
          conversationId: selectedConversation?.id,
          clientUserId: currentClientUserId,
          clientUserName: profile?.full_name || (profile as any)?.first_name || 'Agent',
          ...extraBody,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Action failed');
      if (actionName !== 'send_message') {
        toast({ title: "Success", description: "Action completed" });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (selectedConversation?.id) {
        // Don't reload transcripts for end_handover or send_message — Realtime subscription handles new messages
        if (actionName !== 'end_handover' && actionName !== 'send_message' && actionName !== 'accept_handover' && actionName !== 'take_over') {
          loadTranscripts(selectedConversation.id);
        }
        const { data: p } = await supabase
          .from('handover_sessions')
          .select('*, departments:department_id(name, code, color, timeout_seconds)')
          .eq('conversation_id', selectedConversation.id)
          .eq('status', 'pending')
          .maybeSingle();
        setPendingSession(p);
        const { data: a } = await supabase
          .from('handover_sessions')
          .select('*, departments:department_id(name, code, color)')
          .eq('conversation_id', selectedConversation.id)
          .eq('status', 'active')
          .maybeSingle();
        setActiveSession(a);
        const { data: updated } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', selectedConversation.id)
          .single();
        if (updated) setSelectedConversation(updated as Conversation);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || 'Failed', variant: "destructive" });
    } finally {
      setHandoverLoading(null);
    }
  };

  const insertCannedResponse = (body: string) => {
    const agentName = profile?.full_name || (profile as any)?.first_name || 'Agent';
    const deptName = activeSession?.departments?.name || pendingSession?.departments?.name || 'Support';
    
    const resolved = body
      .replace(/\{\{agent_name\}\}/g, agentName)
      .replace(/\{\{department\}\}/g, deptName);
    
    setChatMessage(resolved);
    setShowCannedDropdown(false);
  };

  const addPersonalResponse = async () => {
    if (!newPersonalTitle.trim() || !newPersonalBody.trim() || !user?.id) return;
    await supabase.from("canned_responses").insert({
      user_id: user.id,
      category: newPersonalCategory.trim() || "General",
      title: newPersonalTitle.trim(),
      body: newPersonalBody.trim(),
      sort_order: personalResponses.length,
    });
    setNewPersonalTitle(""); setNewPersonalBody(""); setNewPersonalCategory("General");
    setAddingPersonal(false);
    const { data } = await supabase
      .from("canned_responses")
      .select("*")
      .eq("user_id", user.id)
      .is("agent_id", null)
      .order("category")
      .order("sort_order");
    setPersonalResponses(data || []);
  };

  const deletePersonalResponse = async (id: string) => {
    await supabase.from("canned_responses").delete().eq("id", id);
    setPersonalResponses(prev => prev.filter(r => r.id !== id));
  };

  const handleAiEnhance = async (mode: string) => {
    if (!chatMessage.trim()) return;
    setAiEnhancing(true);
    setAiEnhanceMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke('ai-enhance', {
        body: { message: chatMessage.trim(), mode },
      });
      if (error) throw error;
      if (data?.enhanced) {
        setAiEnhancedText(data.enhanced);
      }
    } catch (e) {
      console.error('AI enhance error:', e);
      toast({ title: "Error", description: "Failed to enhance message", variant: "destructive" });
    } finally {
      setAiEnhancing(false);
    }
  };

  const acceptEnhanced = () => {
    setChatMessage(aiEnhancedText);
    setAiEnhancedText("");
    setAiEnhanceMode(null);
    setAiEnhanceOpen(false);
  };

  const dismissEnhanced = () => {
    setAiEnhancedText("");
    setAiEnhanceMode(null);
  };

  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || sendingMessage) return;
    const messageText = chatMessage.trim();
    setChatMessage("");
    setSendingMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke('handover-actions', {
        body: {
          action: 'send_message',
          conversationId: selectedConversation?.id,
          clientUserId: currentClientUserId,
          clientUserName: profile?.full_name || (profile as any)?.first_name || 'Agent',
          message: messageText,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      // Don't reload transcripts — the Realtime subscription will pick up the new message
    } catch (err: any) {
      toast({ title: "Error", description: err.message || 'Failed to send message', variant: "destructive" });
      setChatMessage(messageText);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEndHandover = async (resolve: boolean) => {
    setEndHandoverOpen(false);
    if (resolve) {
      handleResolveWithReason('end_handover');
    } else {
      await callHandoverAction('end_handover', { resolve: false });
    }
  };

  const handleResolveWithReason = (action: 'end_handover' | 'mark_resolved') => {
    if (resolutionReasons.length > 0) {
      setResolveAction(action);
      setResolveReason('');
      setResolveNote('');
      setResolveModalOpen(true);
    } else {
      if (action === 'end_handover') {
        callHandoverAction('end_handover', { resolve: true });
      } else {
        callHandoverAction('mark_resolved');
      }
    }
  };

  const handleSubmitResolution = async () => {
    const selectedReason = resolutionReasons.find(r => r.id === resolveReason);
    if (selectedReason?.note_required && !resolveNote.trim()) return;
    setResolveModalOpen(false);
    if (resolveAction === 'end_handover') {
      await callHandoverAction('end_handover', {
        resolve: true,
        resolution_reason: selectedReason?.label || null,
        resolution_note: resolveNote.trim() || null,
      });
    } else {
      await callHandoverAction('mark_resolved', {
        resolution_reason: selectedReason?.label || null,
        resolution_note: resolveNote.trim() || null,
      });
    }
  };

  const handleTransfer = async () => {
    if (!transferDeptId || !transferNote.trim()) return;
    setTransferOpen(false);
    await callHandoverAction('transfer', { targetDepartmentId: transferDeptId, transferNote: transferNote.trim() });
    setTransferNote("");
    setTransferDeptId("");
  };

  const handleTakeover = async () => {
    setTakeoverConfirmOpen(false);
    await callHandoverAction('take_over');
  };

  const availableTags = (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.filter((t: any) => t.enabled) || [];

  const resolutionReasons: Array<{ id: string; label: string; note_required: boolean }> = (agentConfig as any)?.resolution_reasons || [];

  // Department counts (before department filter so all counts stay visible)
  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of conversations) {
      if (c.department_id) {
        counts.set(c.department_id, (counts.get(c.department_id) || 0) + 1);
      }
    }
    return counts;
  }, [conversations]);

  // Client-side filtering (department + tags) + pinning
  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (departmentFilters.length > 0) {
      result = result.filter(c => c.department_id && departmentFilters.includes(c.department_id));
    }
    if (tagFilters.length > 0) {
      result = result.filter(c =>
        tagFilters.some(tag => c.metadata?.tags?.includes(tag))
      );
    }
    // Pin priority: Tier 1 = pending/waiting, Tier 2 = in_handover with unanswered message
    result = [...result].sort((a, b) => {
      const aTier = pendingConversationIds.has(a.id) ? 1
        : (a.status === 'in_handover' && a.first_unanswered_message_at) ? 2
        : 3;
      const bTier = pendingConversationIds.has(b.id) ? 1
        : (b.status === 'in_handover' && b.first_unanswered_message_at) ? 2
        : 3;
      return aTier - bTier;
    });
    return result;
  }, [conversations, tagFilters, departmentFilters, pendingConversationIds]);

  const allSelected = filteredConversations.length > 0 &&
    filteredConversations.every(c => selectedConversationIds.has(c.id));

  

  const getResponseTimeColor = (seconds: number) => {
    const greenMax = (agentConfig as any)?.response_thresholds?.green_seconds || 60;
    const amberMax = (agentConfig as any)?.response_thresholds?.amber_seconds || 300;
    if (seconds <= greenMax) return { color: '#22c55e', label: 'green' };
    if (seconds <= amberMax) return { color: '#f59e0b', label: 'amber' };
    return { color: '#ef4444', label: 'red' };
  };

  const formatWaitTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const getWaitSeconds = (conversation: any) => {
    if (!conversation.first_unanswered_message_at) return 0;
    return Math.floor((Date.now() - new Date(conversation.first_unanswered_message_at).getTime()) / 1000);
  };


  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Unified header ── */}
      <div className="bg-card flex-shrink-0">
        {/* Row 1: Title + count */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-2">
          <h1 className="text-[15px] font-semibold">Conversations</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded border">
            {filteredConversations.length}
          </span>
        </div>

        {/* Row 2: Status filters (multi-select toggle) */}
        <div className="px-4 py-2 flex items-center gap-1">
          <Button
            size="sm"
            variant={statusFilters.length === 0 ? 'default' : 'ghost'}
            onClick={() => setStatusFilters([])}
            className="h-7 text-xs px-3"
          >
            All
          </Button>
          {(['with_ai', 'waiting', 'in_handover', 'aftercare', 'needs_review', 'resolved'] as const).map(s => {
            const isActive = statusFilters.includes(s);
            return (
              <Button
                key={s}
                size="sm"
                variant={isActive ? 'default' : 'ghost'}
                onClick={() => {
                  setStatusFilters(prev => {
                    const next = isActive ? prev.filter(x => x !== s) : [...prev, s];
                    return next.length === 6 ? [] : next;
                  });
                }}
                className="h-7 text-xs px-3"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full mr-1.5",
                  s === 'with_ai' && 'bg-green-500',
                  s === 'waiting' && 'bg-red-500',
                  s === 'in_handover' && 'bg-blue-500',
                  s === 'aftercare' && 'bg-yellow-500',
                  s === 'needs_review' && 'bg-amber-500',
                  s === 'resolved' && 'bg-gray-400'
                )} />
                {s === 'with_ai' ? 'With AI' : s === 'waiting' ? 'Waiting' : s === 'in_handover' ? 'In Handover' : s === 'aftercare' ? 'Aftercare' : s === 'needs_review' ? 'Needs Review' : 'Resolved'}
              </Button>
            );
          })}
        </div>

        {/* Row 2b: Department filters (multi-select toggle, hidden for single department) */}
        {departments.length > 1 && (
          <div className="px-4 py-1 flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={departmentFilters.length === 0 ? 'default' : 'ghost'}
              onClick={() => setDepartmentFilters([])}
              className="h-7 text-xs px-3"
            >
              All ({conversations.length})
            </Button>
            {departments.map(dept => {
              const count = departmentCounts.get(dept.id) || 0;
              const isActive = departmentFilters.includes(dept.id);
              return (
                <Button
                  key={dept.id}
                  size="sm"
                  variant={isActive ? 'default' : 'ghost'}
                  onClick={() => {
                    setDepartmentFilters(prev => {
                      const next = isActive ? prev.filter(x => x !== dept.id) : [...prev, dept.id];
                      return next.length === departments.length ? [] : next;
                    });
                  }}
                  className={cn("h-7 text-xs px-3", count === 0 && !isActive && "opacity-40")}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full mr-1.5"
                    style={{ backgroundColor: dept.color || '#6B7280' }}
                  />
                  {dept.name} ({count})
                </Button>
              );
            })}
          </div>
        )}
        {/* Row 3: Filter chips */}
        <div className="px-4 pb-2 flex items-center gap-1.5 border-b border-border flex-wrap">
          {/* Active tag filter chips */}
          {tagFilters.map(tf => {
            const tagConfig = availableTags.find((t: any) => t.label === tf);
            return (
              <button
                key={tf}
                onClick={() => toggleTagFilter(tf)}
                className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
              >
                {tf}
                <X className="w-2.5 h-2.5" />
              </button>
            );
          })}
          {/* Available tag filter chips (inactive) */}
          {availableTags.filter((t: any) => !tagFilters.includes(t.label)).map((tag: any) => (
            <button
              key={tag.id}
              onClick={() => toggleTagFilter(tag.label)}
              className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground flex items-center gap-1 cursor-pointer hover:border-foreground/30"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.label}
            </button>
          ))}
          <button className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted-foreground flex items-center gap-1 cursor-pointer hover:border-foreground/30">
            <Plus className="w-2.5 h-2.5" />
            Assigned
          </button>
        </div>
      </div>

      {/* ── Three-panel workspace ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-[320px_minmax(300px,1fr)_340px] h-full">

          {/* LEFT PANEL: Conversation list */}
          <div className="flex flex-col border-r border-border h-full overflow-hidden">

            {/* Bulk Actions Toolbar */}
            {selectedConversationIds.size > 0 && (
              <div className="px-3 py-2 bg-muted border-b border-border flex items-center gap-1.5 flex-wrap">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedConversationIds(new Set(filteredConversations.map(c => c.id)));
                    } else {
                      setSelectedConversationIds(new Set());
                    }
                  }}
                />
                <span className="text-xs font-medium text-foreground">
                  {selectedConversationIds.size} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-auto"
                  onClick={() => setSelectedConversationIds(new Set())}
                >
                  <X className="h-3 w-3" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs px-2">Status</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => bulkUpdateStatus('needs_review')}>
                      <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />Needs Review
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => bulkUpdateStatus('resolved')}>
                      <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />Resolved
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {availableTags.length > 0 && (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2">+ Tag</Button>
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
                        <Button variant="outline" size="sm" className="h-6 text-xs px-2">− Tag</Button>
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

            {/* Conversation list */}
            <ScrollArea className="flex-1">
              <div>
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
                  filteredConversations.map((conv) => {
                    const isChecked = selectedConversationIds.has(conv.id);
                    const isSelected = selectedConversation?.id === conv.id;
                    const rawName = conv.metadata?.variables?.user_name || conv.caller_phone || 'Unknown';
                    const hasRealName = !!conv.metadata?.variables?.user_name;
                    const displayName = (!hasRealName && rawName.length > 8) ? 'User…' + rawName.slice(-4) : rawName;
                    const isMine = !!currentClientUserId && conv.owner_id === currentClientUserId;

                    return (
                      <div
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={cn(
                          "group border-l-[3px] px-4 py-3 border-b border-border cursor-pointer transition-colors",
                          conv.status === 'with_ai' && "border-l-green-500",
                          conv.status === 'waiting' && "border-l-red-500",
                          conv.status === 'in_handover' && "border-l-blue-500",
                          conv.status === 'aftercare' && "border-l-yellow-500",
                          conv.status === 'needs_review' && "border-l-amber-500",
                          conv.status === 'resolved' && "border-l-gray-400",
                          (!['with_ai', 'waiting', 'in_handover', 'aftercare', 'needs_review', 'resolved'].includes(conv.status)) && "border-l-border",
                          (pendingConversationIds.has(conv.id) || conv.status === 'waiting') && "bg-red-50/80 dark:bg-red-950/20 border-l-red-500",
                          !pendingConversationIds.has(conv.id) && conv.status !== 'waiting' && isMine && conv.status === 'in_handover' && "bg-blue-50/70 dark:bg-blue-950/20",
                          !pendingConversationIds.has(conv.id) && conv.status !== 'waiting' && isMine && conv.status === 'aftercare' && "bg-yellow-50/70 dark:bg-yellow-950/20",
                          !pendingConversationIds.has(conv.id) && conv.status !== 'waiting' && isMine && conv.status === 'needs_review' && "bg-amber-50/70 dark:bg-amber-950/20",
                          !pendingConversationIds.has(conv.id) && conv.status !== 'waiting' && isMine && conv.status === 'resolved' && "bg-gray-50/70 dark:bg-gray-950/20",
                          isSelected ? "bg-primary/5" : pendingConversationIds.has(conv.id) ? "" : isMine ? "" : "hover:bg-muted/40"
                        )}
                      >
                        {/* Row 1: Name + You badge + department pill */}
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                setSelectedConversationIds(prev => {
                                  const next = new Set(prev);
                                  if (checked) next.add(conv.id); else next.delete(conv.id);
                                  return next;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={cn(
                                "shrink-0 transition-opacity",
                                isChecked ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              )}
                            />
                            <span className="text-[13px] font-medium truncate" title={rawName}>{displayName}</span>
                            {isMine && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">You</span>
                            )}
                            {conv.is_widget_test && (
                              <Badge variant="outline" className="text-[10px] shrink-0 px-1 py-0">🧪</Badge>
                            )}
                            {conv.status === 'needs_review' && (
                              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                          </div>
                          {departments.length > 1 && conv.department_id && (() => {
                            const dept = departments.find(d => d.id === conv.department_id);
                            return dept ? (
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium border shrink-0 ml-2"
                                style={{
                                  backgroundColor: `${dept.color || '#6B7280'}15`,
                                  borderColor: `${dept.color || '#6B7280'}40`,
                                  color: dept.color || '#6B7280',
                                }}
                              >
                                {dept.name}
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {/* Row 2: Last activity date/time */}
                        <p className="text-xs text-muted-foreground truncate pl-6 mb-1.5">
                          {format(new Date(conv.last_activity_at || conv.started_at), 'MMM d, h:mm a')}
                        </p>
                        {/* Row 3: Status badge with owner initials + tags + clock pill */}
                        <div className="flex items-center justify-between pl-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                              conv.status === 'with_ai' && "bg-green-50 text-green-600 border-green-200",
                              conv.status === 'waiting' && "bg-red-50 text-red-600 border-red-200",
                              conv.status === 'in_handover' && "bg-blue-50 text-blue-600 border-blue-200",
                              conv.status === 'aftercare' && "bg-yellow-50 text-yellow-600 border-yellow-200",
                              conv.status === 'needs_review' && "bg-amber-50 text-amber-600 border-amber-200",
                              conv.status === 'resolved' && "bg-gray-100 text-gray-500 border-gray-200",
                              (!['with_ai', 'waiting', 'in_handover', 'aftercare', 'needs_review', 'resolved'].includes(conv.status)) && "bg-muted text-muted-foreground border-border"
                            )}>
                              {conv.status === 'with_ai' ? 'With AI'
                                : conv.status === 'waiting' ? 'Waiting'
                                : conv.status === 'in_handover' ? 'In Handover'
                                : conv.status === 'aftercare' ? 'Aftercare'
                                : conv.status === 'needs_review' ? 'Needs Review'
                                : conv.status === 'resolved' ? 'Resolved'
                                : conv.status === 'active' ? 'Active (Legacy)'
                                : conv.status === 'completed' ? 'Completed'
                                : conv.status === 'owned' ? 'Owned (Legacy)'
                                : conv.status.charAt(0).toUpperCase() + conv.status.slice(1)}
                              {conv.owner_name && ['in_handover', 'aftercare', 'needs_review', 'resolved', 'waiting'].includes(conv.status) && (
                                `: ${conv.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}`
                              )}
                            </span>
                            {conv.metadata?.tags?.map((tag: string) => {
                              const tagConfig = (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.find(
                                (t: any) => t.label === tag
                              );
                              return tagConfig ? (
                                <span
                                  key={tag}
                                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border"
                                  style={{
                                    backgroundColor: `${tagConfig.color}20`,
                                    borderColor: tagConfig.color,
                                    color: tagConfig.color
                                  }}
                                >
                                  {tag}
                                </span>
                              ) : null;
                            })}
                          </div>
                          {/* Clock pill — show for in_handover with unanswered msg OR pending handover */}
                          {(() => {
                            const isPending = pendingConversationIds.has(conv.id);
                            const isInHandover = conv.status === 'in_handover' && !!conv.first_unanswered_message_at;
                            if (!isPending && !isInHandover) return null;
                            
                            const waitStart = isPending
                              ? pendingConversationIds.get(conv.id)!
                              : conv.first_unanswered_message_at!;
                            const waitSec = Math.floor((Date.now() - new Date(waitStart).getTime()) / 1000);
                            const { color } = getResponseTimeColor(waitSec);
                            return (
                              <span
                                className="shrink-0 ml-2"
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                  background: `${color}14`,
                                  color: color,
                                  border: `1px solid ${color}35`,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                <Clock className="inline h-2.5 w-2.5 mr-0.5" style={{ verticalAlign: 'middle' }} />{formatWaitTime(waitSec)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })
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

          {/* MIDDLE PANEL: Transcript */}
          <div className="flex flex-col border-r border-border h-full overflow-hidden relative bg-muted/30">
            {selectedConversation ? (
              <>
                <div className="px-4 py-3 border-b border-border flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">
                      {(() => {
                        const raw = selectedConversation.metadata?.variables?.user_name || selectedConversation.caller_phone || 'Unknown';
                        const hasName = !!selectedConversation.metadata?.variables?.user_name;
                        const display = (!hasName && raw.length > 8) ? 'User…' + raw.slice(-4) : raw;
                        return <span title={raw}>{display}</span>;
                      })()}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      Started {format(new Date(selectedConversation.started_at), 'PPp')}
                      <span className="mx-0.5">·</span>
                      <MessageSquareText className="inline h-3 w-3" />
                      {transcripts.length}
                    </p>
                  </div>
                  {departments.length > 1 && selectedConversation.department_id && (() => {
                    const dept = departments.find(d => d.id === selectedConversation.department_id);
                    return dept ? (
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border shrink-0"
                        style={{
                          backgroundColor: `${dept.color || '#6B7280'}15`,
                          borderColor: `${dept.color || '#6B7280'}40`,
                          color: dept.color || '#6B7280',
                        }}
                      >
                        {dept.name}
                      </span>
                    ) : null;
                  })()}
                </div>
                <ScrollArea
                  className="flex-1 min-h-0"
                  viewportRef={transcriptScrollRef}
                  onViewportScroll={handleTranscriptScroll}
                >
                  <div className="p-4">
                    {transcripts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No transcript available for this conversation.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {transcripts.map((transcript, index) => {
                          // System messages render as centered indicators
                          if (transcript.speaker === 'system') {
                            if (!transcript.text?.trim()) return null; // Don't render empty system messages
                            return (
                              <div key={transcript.id || index} className="flex justify-center my-3">
                                <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full border border-border">
                                  {transcript.text}
                                </div>
                              </div>
                            );
                          }

                          // Client user messages render with name label and distinct style
                          if (transcript.speaker === 'client_user') {
                            const name = transcript.metadata?.client_user_name || 'Agent';
                            return (
                              <div key={transcript.id || index} className="flex gap-2 mb-4">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-primary">
                                  {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-[11px] font-medium text-primary mb-0.5 block">{name}</span>
                                  <div className="bg-card border border-border px-3 py-2 rounded-xl rounded-tl-sm text-sm max-w-[400px]">
                                    {transcript.text}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground mt-0.5 ml-1">{format(new Date(transcript.timestamp), 'h:mm a')}</span>
                                </div>
                              </div>
                            );
                          }

                          // User and assistant messages use the existing MessageBubble
                          const speaker = transcript.speaker === 'user' ? 'user' : 'assistant';
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
                    className="absolute bottom-16 left-1/2 -translate-x-1/2 shadow-lg z-10"
                    size="sm"
                    onClick={jumpToLatest}
                  >
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Jump to latest
                  </Button>
                )}

                {/* Customer waiting indicator */}
                {selectedConversation.status === 'in_handover' && 
                 selectedConversation.owner_id === currentClientUserId && 
                 selectedConversation.first_unanswered_message_at && (() => {
                  const waitSec = getWaitSeconds(selectedConversation);
                  const { color } = getResponseTimeColor(waitSec);
                  return (
                    <div className="flex-shrink-0 px-3 py-1.5 flex items-center gap-2 border-t border-border" style={{
                      background: `${color}08`,
                    }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}60` }} />
                      <span className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-1" style={{ color }} />Customer waiting: <strong style={{ color }}>{formatWaitTime(waitSec)}</strong>
                      </span>
                    </div>
                  );
                })()}

                {/* Chat Input */}
                <div className="flex-shrink-0 border-t border-border bg-background p-3">
                  {selectedConversation.status === 'in_handover' && selectedConversation.owner_id === currentClientUserId ? (
                    <div className="flex items-center gap-2">
                      {/* Canned responses button */}
                      <Popover open={showCannedDropdown} onOpenChange={setShowCannedDropdown}>
                        <PopoverTrigger asChild>
                          <Button size="icon" variant="ghost" className="shrink-0">
                            <MessageSquareText className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 max-h-[400px] overflow-hidden" side="top" align="start">
                          <Tabs value={cannedTab} onValueChange={v => setCannedTab(v as 'org' | 'personal')}>
                            <TabsList className="w-full rounded-none border-b">
                              <TabsTrigger value="org" className="flex-1 text-xs">Organisation</TabsTrigger>
                              {personalEnabled && <TabsTrigger value="personal" className="flex-1 text-xs">Personal</TabsTrigger>}
                            </TabsList>
                            <div className="max-h-[340px] overflow-y-auto">
                              <TabsContent value="org" className="mt-0">
                                {orgResponses.length === 0 ? (
                                  <div className="p-4 text-xs text-center text-muted-foreground">No org responses configured</div>
                                ) : (
                                  (() => {
                                    const cats = [...new Set(orgResponses.map(r => r.category))].sort();
                                    return cats.map(cat => (
                                      <div key={cat}>
                                        <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 flex items-center gap-1.5">
                                          <FolderOpen className="h-3 w-3" />
                                          {cat}
                                        </div>
                                        {orgResponses.filter(r => r.category === cat).map(r => (
                                          <button
                                            key={r.id}
                                            onClick={() => insertCannedResponse(r.body)}
                                            className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/50"
                                          >
                                            <div className="text-xs font-medium">{r.title}</div>
                                            <div className="text-xs text-muted-foreground truncate">{r.body}</div>
                                          </button>
                                        ))}
                                      </div>
                                    ));
                                  })()
                                )}
                              </TabsContent>
                              
                              {personalEnabled && (
                                <TabsContent value="personal" className="mt-0">
                                  {personalResponses.length === 0 && !addingPersonal ? (
                                    <div className="p-4 text-xs text-center text-muted-foreground">No personal responses yet</div>
                                  ) : (
                                    (() => {
                                      const cats = [...new Set(personalResponses.map(r => r.category))].sort();
                                      return cats.map(cat => (
                                        <div key={cat}>
                                          <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30 flex items-center gap-1.5">
                                            <FolderOpen className="h-3 w-3" />
                                            {cat}
                                          </div>
                                          {personalResponses.filter(r => r.category === cat).map(r => (
                                            <div key={r.id} className="flex items-center border-b border-border/50">
                                              <button
                                                onClick={() => insertCannedResponse(r.body)}
                                                className="flex-1 text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                                              >
                                                <div className="text-xs font-medium">{r.title}</div>
                                                <div className="text-xs text-muted-foreground truncate">{r.body}</div>
                                              </button>
                                              <Button size="icon" variant="ghost" className="h-6 w-6 mr-1 shrink-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => deletePersonalResponse(r.id)}>
                                                <Trash2 className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          ))}
                                        </div>
                                      ));
                                    })()
                                  )}
                                  
                                  {/* Add personal response inline */}
                                  {addingPersonal ? (
                                    <div className="p-3 space-y-2 border-t">
                                      <Input className="text-xs h-7" placeholder="Category" value={newPersonalCategory} onChange={e => setNewPersonalCategory(e.target.value)} />
                                      <Input className="text-xs h-7" placeholder="Title" value={newPersonalTitle} onChange={e => setNewPersonalTitle(e.target.value)} />
                                      <Textarea className="text-xs min-h-[50px]" placeholder="Message body..." value={newPersonalBody} onChange={e => setNewPersonalBody(e.target.value)} />
                                      <div className="flex gap-2">
                                        <Button size="sm" className="text-xs h-7" onClick={addPersonalResponse}>Save</Button>
                                        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setAddingPersonal(false)}>Cancel</Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setAddingPersonal(true)}
                                      className="w-full px-3 py-2 text-xs text-primary hover:bg-muted/50 flex items-center gap-1 border-t"
                                    >
                                      <Plus className="h-3 w-3" /> Add personal response
                                    </button>
                                  )}
                                </TabsContent>
                              )}
                            </div>
                          </Tabs>
                        </PopoverContent>
                      </Popover>
                      {/* AI Enhance button */}
                      <Popover open={aiEnhanceOpen} onOpenChange={setAiEnhanceOpen}>
                        <PopoverTrigger asChild>
                          <Button size="icon" variant="ghost" className="shrink-0" disabled={!chatMessage.trim()}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          {aiEnhancedText ? (
                            <div className="p-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                {aiEnhanceMode === 'improve' ? 'Improved' : aiEnhanceMode === 'concise' ? 'Concise' : 'Friendly'} version
                              </div>
                              <p className="text-sm">{aiEnhancedText}</p>
                              <div className="flex gap-2">
                                <Button size="sm" className="text-xs h-7 gap-1" onClick={acceptEnhanced}>
                                  <Check className="h-3 w-3" /> Use this
                                </Button>
                                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={dismissEnhanced}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2 space-y-1">
                              <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Enhance with AI</div>
                              <button
                                onClick={() => handleAiEnhance('improve')}
                                disabled={aiEnhancing}
                                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {aiEnhancing && aiEnhanceMode === 'improve' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                <div>
                                  <div className="font-medium">Improve</div>
                                  <div className="text-xs text-muted-foreground">Grammar + tone</div>
                                </div>
                              </button>
                              <button
                                onClick={() => handleAiEnhance('concise')}
                                disabled={aiEnhancing}
                                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {aiEnhancing && aiEnhanceMode === 'concise' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                <div>
                                  <div className="font-medium">Concise</div>
                                  <div className="text-xs text-muted-foreground">Shorter</div>
                                </div>
                              </button>
                              <button
                                onClick={() => handleAiEnhance('friendly')}
                                disabled={aiEnhancing}
                                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                {aiEnhancing && aiEnhanceMode === 'friendly' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                <div>
                                  <div className="font-medium">Friendly</div>
                                  <div className="text-xs text-muted-foreground">Warmer</div>
                                </div>
                              </button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <Input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage();
                          }
                        }}
                        disabled={sendingMessage}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendChatMessage}
                        disabled={sendingMessage || !chatMessage.trim()}
                      >
                        {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Lock className="h-4 w-4 shrink-0" />
                      <span className="text-xs">
                        {selectedConversation.status === 'in_handover'
                          ? "Another agent is handling this conversation"
                          : "Chat input available during active handover only"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
                <p className="text-xs text-muted-foreground/60">Click a conversation on the left to view the transcript</p>
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Details */}
          <div className="flex flex-col h-full overflow-hidden">
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-4">
                {selectedConversation ? (
                  <>
                    {/* Handover Control Card */}
                    <Card className={cn(
                      "p-3",
                      pendingSession && "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800",
                      !pendingSession && selectedConversation.status === 'in_handover' && "border-blue-300 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800",
                      !pendingSession && selectedConversation.status === 'aftercare' && "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800",
                      !pendingSession && selectedConversation.status === 'needs_review' && "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800",
                      !pendingSession && selectedConversation.status === 'resolved' && "border-gray-300 bg-gray-50 dark:bg-gray-950/20 dark:border-gray-700"
                    )}>
                      {/* WITH AI or WAITING with no pending session (edge case fallback) */}
                      {(selectedConversation.status === 'with_ai' || (selectedConversation.status === 'waiting' && !pendingSession)) && !pendingSession && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Handover</p>
                          <Button
                            size="sm"
                            className="w-full bg-foreground text-background hover:bg-foreground/90"
                            onClick={() => setTakeoverConfirmOpen(true)}
                            disabled={handoverLoading === 'take_over'}
                          >
                            {handoverLoading === 'take_over' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                            Take Over Conversation
                          </Button>
                        </div>
                      )}

                      {/* PENDING — handover request waiting */}
                      {pendingSession && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {pendingSession.takeover_type === 'transfer' ? 'Transfer Request' : 'Handover Request'}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Timer className="h-3 w-3" />
                              {pendingSession.departments?.timeout_seconds || 300}s
                            </div>
                          </div>
                          {pendingSession.takeover_type === 'transfer' ? (
                            <>
                              <p className="text-xs text-muted-foreground">
                                Transferred from <span className="font-medium text-foreground">{pendingSession.transferred_from_department_name || 'another department'}</span> by <span className="font-medium text-foreground">{pendingSession.transferred_from_agent_name || 'an agent'}</span>
                              </p>
                              {pendingSession.transfer_note && (
                                <div className="bg-white dark:bg-background rounded-md p-2 border border-red-200 dark:border-red-800">
                                  <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Transfer note:</p>
                                  <p className="text-xs text-foreground">{pendingSession.transfer_note}</p>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">Customer requested a human agent</p>
                          )}
                          <Button
                            size="sm"
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => callHandoverAction(pendingSession.takeover_type === 'transfer' ? 'accept_transfer' : 'accept_handover')}
                            disabled={!!handoverLoading}
                          >
                            {handoverLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
                            {pendingSession.takeover_type === 'transfer' ? 'Accept Transfer' : 'Accept Handover'}
                          </Button>
                        </div>
                      )}

                      {/* IN HANDOVER — mine */}
                      {selectedConversation.status === 'in_handover' && selectedConversation.owner_id === currentClientUserId && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Handover</p>
                            </div>
                            {activeSession?.accepted_at && (
                              <span className="text-[10px] font-medium text-muted-foreground font-mono tabular-nums">
                                {(() => {
                                  const secs = Math.floor((Date.now() - new Date(activeSession.accepted_at).getTime()) / 1000);
                                  const h = Math.floor(secs / 3600);
                                  const m = Math.floor((secs % 3600) / 60);
                                  const s = secs % 60;
                                  return h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2, '0')}s`;
                                })()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">You are handling this conversation</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setEndHandoverOpen(true)}
                              disabled={!!handoverLoading}
                            >
                              <PhoneOff className="h-3.5 w-3.5 mr-1.5" />
                              End Handover
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setTransferOpen(true)}
                              disabled={!!handoverLoading}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
                              Transfer
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* IN HANDOVER — someone else */}
                      {selectedConversation.status === 'in_handover' && selectedConversation.owner_id !== currentClientUserId && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Handover</p>
                            </div>
                            {activeSession?.accepted_at && (
                              <span className="text-[10px] font-medium text-muted-foreground font-mono tabular-nums">
                                {(() => {
                                  const secs = Math.floor((Date.now() - new Date(activeSession.accepted_at).getTime()) / 1000);
                                  const h = Math.floor(secs / 3600);
                                  const m = Math.floor((secs % 3600) / 60);
                                  const s = secs % 60;
                                  return h > 0 ? `${h}h ${m}m` : `${m}m ${s.toString().padStart(2, '0')}s`;
                                })()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Being handled by {selectedConversation.owner_name || 'another agent'}
                          </p>
                        </div>
                      )}

                      {/* AFTERCARE */}
                      {selectedConversation.status === 'aftercare' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-up Required</p>
                          </div>
                          <p className="text-xs text-muted-foreground">Handover ended — not yet resolved</p>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleResolveWithReason('mark_resolved')}
                            disabled={!!handoverLoading}
                          >
                            {handoverLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Mark as Resolved
                          </Button>
                        </div>
                      )}

                      {/* NEEDS REVIEW */}
                      {selectedConversation.status === 'needs_review' && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Needs Review</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {(selectedConversation as any).needs_review_reason === 'timeout'
                              ? 'No agents were available to accept this handover'
                              : (selectedConversation as any).needs_review_reason === 'department_closed'
                              ? 'Handover was requested outside of opening hours'
                              : (selectedConversation as any).needs_review_reason === 'inactivity'
                              ? 'Closed due to customer inactivity during handover'
                              : 'This conversation needs attention'}
                          </p>
                          <Button
                            size="sm"
                            className="w-full bg-foreground text-background hover:bg-foreground/90"
                            onClick={() => setTakeoverConfirmOpen(true)}
                            disabled={!!handoverLoading}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Take Over Conversation
                          </Button>
                          <Button
                            size="sm"
                            className="w-full"
                            onClick={() => handleResolveWithReason('mark_resolved')}
                            disabled={!!handoverLoading}
                          >
                            {handoverLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Mark as Resolved
                          </Button>
                        </div>
                      )}

                      {/* RESOLVED */}
                      {selectedConversation.status === 'resolved' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Resolved{selectedConversation.resolution_reason ? ` — ${selectedConversation.resolution_reason}` : ''}
                            </p>
                          </div>
                          {selectedConversation.resolution_note ? (
                            <p className="text-xs text-muted-foreground italic">"{selectedConversation.resolution_note}"</p>
                          ) : !selectedConversation.resolution_reason ? (
                            <p className="text-xs text-muted-foreground">This conversation has been resolved</p>
                          ) : null}
                        </div>
                      )}

                      {/* Previous handover history (inside the card) */}
                      {handoverHistory.length > 0 && (
                        <div className="border-t border-border/50 mt-2 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                            {handoverHistory.length === 1 ? 'Previous handover' : `Previous handovers (${handoverHistory.length})`}
                          </p>
                          <div className="space-y-1.5">
                            {(showAllHandoverHistory ? handoverHistory : handoverHistory.slice(0, 1)).map((session: any) => {
                              const duration = session.accepted_at && session.completed_at
                                ? Math.floor((new Date(session.completed_at).getTime() - new Date(session.accepted_at).getTime()) / 1000)
                                : null;
                              const durationStr = duration !== null
                                ? duration >= 3600
                                  ? `${Math.floor(duration / 3600)}h ${Math.floor((duration % 3600) / 60)}m`
                                  : duration >= 60
                                    ? `${Math.floor(duration / 60)}m ${(duration % 60).toString().padStart(2, '0')}s`
                                    : `${duration}s`
                                : null;
                              return (
                                <div key={session.id} className="bg-white dark:bg-background rounded-md p-2 border border-border/30">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: session.departments?.color || '#6B7280' }} />
                                      <span className="text-[11px] font-medium">{session.departments?.name || 'Unknown'}</span>
                                      <span className={cn(
                                        "text-[9px] px-1.5 py-0.5 rounded",
                                        session.completion_method === 'transfer'
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"
                                      )}>
                                        {session.completion_method === 'transfer' ? 'Transferred' : 'Handback'}
                                      </span>
                                    </div>
                                    {durationStr && <span className="text-[10px] text-muted-foreground">{durationStr}</span>}
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">
                                    {session.agent_name || 'Unknown agent'} · {new Date(session.completed_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}, {new Date(session.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                  {session.transfer_note && (
                                    <p className="text-[10px] text-foreground mt-1 italic">"{session.transfer_note}"</p>
                                  )}
                                </div>
                              );
                            })}
                            {handoverHistory.length > 1 && (
                              <button
                                onClick={() => setShowAllHandoverHistory(!showAllHandoverHistory)}
                                className="w-full text-center py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {showAllHandoverHistory ? 'Show less' : `Show ${handoverHistory.length - 1} more`}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Card>

                    {selectedConversation && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact Info</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground">
                                User ID: <span className="font-mono">…{(selectedConversation.voiceflow_user_id || selectedConversation.caller_phone || '').slice(-5)}</span>
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const fullId = selectedConversation.voiceflow_user_id || selectedConversation.caller_phone || '';
                                  navigator.clipboard.writeText(fullId);
                                  toast({ title: "Copied", description: "User ID copied to clipboard" });
                                }}
                                className="p-0.5 rounded hover:bg-muted transition-colors"
                                title={selectedConversation.voiceflow_user_id || selectedConversation.caller_phone || ''}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2 p-3 bg-muted rounded-lg">
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Name:</span>
                                <span className={`font-medium ${!selectedConversation.metadata?.variables?.user_name ? 'text-muted-foreground italic' : ''}`}>
                                  {selectedConversation.metadata?.variables?.user_name || 'Not captured yet'}
                                </span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Email:</span>
                                <span className={`font-medium ${!selectedConversation.metadata?.variables?.user_email ? 'text-muted-foreground italic' : ''}`}>
                                  {selectedConversation.metadata?.variables?.user_email || 'Not captured yet'}
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

                    {/* Previous conversations from same customer */}
                    {previousConversations.length > 0 && (
                      <div>
                        <button
                          onClick={() => {
                            setShowPreviousConversations(!showPreviousConversations);
                            if (showPreviousConversations) setShowAllPreviousConversations(false);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full mb-2"
                        >
                          <MessageSquareText className="w-3 h-3" />
                          {previousConversations.length} Conversation{previousConversations.length !== 1 ? 's' : ''}
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={cn("transition-transform ml-auto", showPreviousConversations && "rotate-90")}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                        {showPreviousConversations && (
                          <div className="space-y-1">
                            {(showAllPreviousConversations ? previousConversations : previousConversations.slice(0, 2)).map((conv: any) => (
                              <button
                                key={conv.id}
                                onClick={() => {
                                  setSelectedConversation(conv);
                                  setShowAllPreviousConversations(false);
                                }}
                                className="w-full flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    conv.status === 'with_ai' && "bg-green-500",
                                    conv.status === 'waiting' && "bg-red-500",
                                    conv.status === 'in_handover' && "bg-blue-500",
                                    conv.status === 'aftercare' && "bg-yellow-500",
                                    conv.status === 'needs_review' && "bg-amber-500",
                                    conv.status === 'resolved' && "bg-gray-400"
                                  )} />
                                  <span className="text-xs truncate">
                                    {conv.status === 'with_ai' ? 'With AI'
                                      : conv.status === 'waiting' ? 'Waiting'
                                      : conv.status === 'in_handover' ? 'In Handover'
                                      : conv.status === 'aftercare' ? 'Aftercare'
                                      : conv.status === 'needs_review' ? 'Needs Review'
                                      : conv.status === 'resolved' ? 'Resolved'
                                      : conv.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                  {conv.last_activity_at ? new Date(conv.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                </span>
                              </button>
                            ))}
                            {previousConversations.length > 2 && (
                              <button
                                onClick={() => setShowAllPreviousConversations(!showAllPreviousConversations)}
                                className="w-full text-center py-1.5 rounded-md border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                              >
                                {showAllPreviousConversations ? 'Show less' : `Show ${previousConversations.length - 2} more`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
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
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Note</p>
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
                  <div className="flex flex-col items-center justify-center gap-2 text-center py-16">
                    <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-muted-foreground">Details will appear here</p>
                    <p className="text-xs text-muted-foreground/60">Select a conversation to view details</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

        </div>
      </div>

      {/* Resolution Reason Modal */}
      <Dialog open={resolveModalOpen} onOpenChange={(open) => { if (!open) setResolveModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve conversation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Select a reason for resolving this conversation</p>
          <div className="space-y-1.5 my-2">
            {resolutionReasons.map((reason) => (
              <label
                key={reason.id}
                onClick={() => setResolveReason(reason.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors",
                  resolveReason === reason.id
                    ? "border-foreground bg-muted"
                    : "border-border hover:bg-muted/50"
                )}
              >
                <span className={cn(
                  "w-4 h-4 rounded-full border-2 shrink-0",
                  resolveReason === reason.id ? "border-[5px] border-foreground" : "border-muted-foreground/30"
                )} />
                <span className="text-sm flex-1">{reason.label}</span>
                {reason.note_required && (
                  <span className="text-[10px] text-muted-foreground">Note required</span>
                )}
              </label>
            ))}
          </div>
          {resolveReason && (() => {
            const selected = resolutionReasons.find(r => r.id === resolveReason);
            return selected ? (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">
                  Note {selected.note_required ? <span className="text-muted-foreground/60">(required)</span> : <span className="text-muted-foreground/60">(optional)</span>}
                </label>
                <textarea
                  value={resolveNote}
                  onChange={(e) => setResolveNote(e.target.value)}
                  placeholder="Add a note about this resolution..."
                  className="w-full min-h-[60px] px-3 py-2 text-sm border rounded-lg resize-none bg-background"
                />
              </div>
            ) : null;
          })()}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setResolveModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmitResolution}
              disabled={!resolveReason || (resolutionReasons.find(r => r.id === resolveReason)?.note_required && !resolveNote.trim())}
            >
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* End Handover Modal */}
      <Dialog open={endHandoverOpen} onOpenChange={setEndHandoverOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End Handover</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">How would you like to end this handover?</p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEndHandoverOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleEndHandover(false)}>
              End — Keep in Aftercare
            </Button>
            <Button onClick={() => handleEndHandover(true)}>
              End &amp; Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Modal */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Conversation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Transfer to Department</Label>
              <Select value={transferDeptId} onValueChange={setTransferDeptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department..." />
                </SelectTrigger>
                <SelectContent>
                  {departments
                    .filter(d => d.id !== activeSession?.department_id)
                    .map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: d.color || '#3b82f6' }}
                          />
                          {d.name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transfer Note (required)</Label>
              <Textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Explain why you're transferring this conversation..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransfer} disabled={!transferDeptId || !transferNote.trim()}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Proactive Takeover Confirmation */}
      <AlertDialog open={takeoverConfirmOpen} onOpenChange={setTakeoverConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take Over Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This customer hasn't requested a human agent. Are you sure you want to take over this conversation from the AI?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeover}>
              Yes, Take Over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
