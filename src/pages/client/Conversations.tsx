import { useEffect, useState, useRef, useMemo, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { ConversationsSkeleton } from "@/components/skeletons";
import { Phone, Clock, CheckCircle, MessageSquare, ArrowDown, ArrowUp, X, Plus, Tag, Users, Building2, Send, UserCheck, PhoneOff, ArrowRightLeft, Lock, Loader2, AlertTriangle, Timer, MessageSquareText, Trash2, FolderOpen, Sparkles, Check, Archive, Paperclip, FileText, Download, Filter, Pin, PinOff } from "lucide-react";
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
import { formatDistanceToNow, format, isSameDay } from "date-fns";
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
import { useImpersonation } from "@/hooks/useImpersonation";
import { useClientDepartments } from "@/hooks/useClientDepartments";
import { ConversationCard } from "@/components/conversations/ConversationCard";
import { formatWaitTime, getResponseTimeColor } from "@/components/conversations/cardUtils";
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

interface Attachment {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio' | 'file';
}

interface Transcript {
  id: string;
  speaker: 'user' | 'assistant' | 'client_user' | 'system';
  text?: string;
  buttons?: Array<{ text: string; payload: any }>;
  timestamp: string;
  attachments?: Attachment[] | null;
  metadata?: {
    button_click?: boolean;
    client_user_id?: string;
    client_user_name?: string;
    type?: string;
    [key: string]: any;
  };
}

const PAGE_SIZE = 30;

// Append `?download=<filename>` so Supabase storage serves the file with
// Content-Disposition: attachment instead of inline. Without this, browsers
// try to render text/csv (and similar) inline, which on some browsers shows
// "missing plugin" instead of downloading. Skip for already-inline kinds
// (image/video/audio) since we want those to render in the bubble.
function withDownloadParam(url: string, fileName: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('download', fileName);
    return u.toString();
  } catch {
    return url;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  // Anchor row injected into the left panel when a search hit lives outside
  // the dashboard's current paginated/filtered list. Cleared when filters
  // change or the user picks a different conversation.
  const [searchAnchor, setSearchAnchor] = useState<Conversation | null>(null);
  // One-shot flag set by the searchParams effect (search-arrival ONLY) so the
  // scroll-into-view effect doesn't fire on plain dashboard card clicks.
  const pendingScrollIdRef = useRef<string | null>(null);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [note, setNote] = useState("");
  const [assignedTags, setAssignedTags] = useState<string[]>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingTags, setUpdatingTags] = useState(false);
  const [tagSearchInput, setTagSearchInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showLeftJumpToLatest, setShowLeftJumpToLatest] = useState(false);
  const leftPanelScrollRef = useRef<HTMLDivElement>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filters — persisted to sessionStorage so the CommandSearch dialog can mirror them.
  // sessionStorage (not localStorage) keeps "fresh tab = clean slate" behaviour.
  const ACTIVE_FILTERS_KEY = 'totaldash_conversations_active_filters';
  const initialActiveFilters = (() => {
    try {
      const raw = sessionStorage.getItem(ACTIVE_FILTERS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        statusFilters: Array.isArray(parsed.statusFilters) ? parsed.statusFilters : [],
        tagFilters: Array.isArray(parsed.tagFilters) ? parsed.tagFilters : [],
        departmentFilters: Array.isArray(parsed.departmentFilters) ? parsed.departmentFilters : [],
        myOnly: !!parsed.myOnly,
      };
    } catch {
      return null;
    }
  })();
  const [statusFilters, setStatusFilters] = useState<string[]>(initialActiveFilters?.statusFilters ?? []);
  const [tagFilters, setTagFilters] = useState<string[]>(initialActiveFilters?.tagFilters ?? []);
  const [departmentFilters, setDepartmentFilters] = useState<string[]>(initialActiveFilters?.departmentFilters ?? []);
  const [myOnly, setMyOnly] = useState<boolean>(initialActiveFilters?.myOnly ?? false);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        ACTIVE_FILTERS_KEY,
        JSON.stringify({ statusFilters, tagFilters, departmentFilters, myOnly }),
      );
    } catch {
      /* sessionStorage may be disabled — fail silently */
    }
  }, [statusFilters, tagFilters, departmentFilters, myOnly]);

  // Filter row visibility prefs (persisted to localStorage; expand state is in-memory only)
  const [pinnedRows, setPinnedRows] = useState<{ status: boolean; department: boolean; tags: boolean }>({
    status: true,
    department: true,
    tags: false,
  });
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Hydrate pinned-rows pref from localStorage on mount.
  // v1 → v2 migration: tags default flipped from pinned to unpinned for everyone.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('totaldash_conversations_ui_prefs');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.pinned) return;
      if (parsed.v === 1) {
        setPinnedRows(p => ({
          status: typeof parsed.pinned.status === 'boolean' ? parsed.pinned.status : p.status,
          department: typeof parsed.pinned.department === 'boolean' ? parsed.pinned.department : p.department,
          tags: false,
        }));
      } else if (parsed.v === 2) {
        setPinnedRows(p => ({
          status: typeof parsed.pinned.status === 'boolean' ? parsed.pinned.status : p.status,
          department: typeof parsed.pinned.department === 'boolean' ? parsed.pinned.department : p.department,
          tags: typeof parsed.pinned.tags === 'boolean' ? parsed.pinned.tags : p.tags,
        }));
      }
    } catch { /* ignore — fall back to defaults */ }
  }, []);

  // Persist pinned rows whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(
        'totaldash_conversations_ui_prefs',
        JSON.stringify({ v: 2, pinned: pinnedRows }),
      );
    } catch { /* ignore — private mode / quota */ }
  }, [pinnedRows]);

  // Bulk select
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());

  const { selectedAgentId, agents, clientId, companyCapabilities } = useClientAgentContext();
  const cannedResponsesEnabled = companyCapabilities?.client_canned_responses_enabled !== false;
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const transcriptScrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { isClientPreviewMode, previewClient, userType } = useMultiTenantAuth();
  // Pull impersonation state directly so loadClientUser can resolve the acting
  // client_user even before the previewClient bridge has finished loading, and
  // so view_as_user mode resolves to the *specific* impersonated user instead
  // of an arbitrary client_user for the client.
  const {
    isImpersonating,
    impersonationMode,
    targetUserId: impersonationTargetUserId,
    targetClientId: impersonationTargetClientId,
    loading: impersonationLoading,
  } = useImpersonation();

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
  const { departments } = useClientDepartments();
  const [pendingSession, setPendingSession] = useState<any>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [handoverHistory, setHandoverHistory] = useState<any[]>([]);
  
  const [currentClientUserId, setCurrentClientUserId] = useState<string | null>(null);
  const [pendingConversationIds, setPendingConversationIds] = useState<Map<string, { createdAt: string; takeoverType: 'handover' | 'transfer'; timeoutSeconds: number }>>(new Map());
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

  // Agent attachment upload state. Two-phase like the widget:
  //   1. User picks file(s) -> queued in `attachQueue`, preview tile renders
  //      above the input. NO upload yet, NO transcript yet.
  //   2. User types optional caption + clicks Send -> each queued file is
  //      uploaded via agent-file-upload. The caption (if any) attaches to the
  //      FIRST committed file's transcript bubble; subsequent files commit
  //      with empty text. Mirrors the widget's send semantics.
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [attachUploading, setAttachUploading] = useState(false);
  // Each queued file gets a stable id so React keys + remove-by-id stay correct
  // across re-renders. previewUrl is an object URL we revoke on remove/send.
  type AttachQueueEntry = { id: string; file: File; previewUrl: string | null; kind: 'image' | 'video' | 'audio' | 'file' };
  const [attachQueue, setAttachQueue] = useState<AttachQueueEntry[]>([]);

  // Drag-and-drop state for the transcript panel. We use the relatedTarget
  // pattern (not a counter) because counters drift when the user drags fast
  // across child elements or when dragend fires outside the panel without a
  // corresponding dragleave. The window-level reset (see useEffect below) is
  // a belt-and-braces failsafe for the same drift scenarios.
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragInvalid, setDragInvalid] = useState(false);

  // Archive (N8) — admin-only via RPC, force-ends + hides the conversation.
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

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
  }, [selectedAgentId, statusFilters, tagFilters, departmentFilters, myOnly]);

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
      
    };
    loadCanned();
  }, [clientId, selectedAgentId, user?.id]);

  useEffect(() => {
    setPersonalEnabled(companyCapabilities?.canned_responses_personal_enabled !== false);
  }, [companyCapabilities]);


  useEffect(() => {
    const convId = searchParams.get('conversationId');
    if (!convId) return;

    // Fast path: already in the paginated list (matches the dashboard's current
    // filter + status). Pick it and flag for scroll-into-view.
    const match = conversations.find(c => c.id === convId);
    if (match) {
      setSelectedConversation(match);
      pendingScrollIdRef.current = convId;
      setSearchParams({}, { replace: true });
      return;
    }

    // Slow path: the conversation was reached via search and lives outside the
    // dashboard's current filter / pagination window. Fetch it directly so the
    // search-click still opens it, AND pin it as a `searchAnchor` row at the
    // top of the left panel so the user can see it visually highlighted.
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        console.warn('[Conversations] could not load conversation by id:', convId, error);
        setSearchParams({}, { replace: true });
        return;
      }
      setSelectedConversation(data as Conversation);
      setSearchAnchor(data as Conversation);
      pendingScrollIdRef.current = convId;
      setSearchParams({}, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [conversations, searchParams]);

  // Search-arrival scroll-into-view (no-op on plain dashboard clicks).
  // The ref is cleared once the scroll runs, so subsequent paginated re-renders
  // don't re-trigger it.
  useEffect(() => {
    const id = pendingScrollIdRef.current;
    if (!id) return;
    if (selectedConversation?.id !== id) return;
    const raf = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-conversation-id="${id}"]`);
      (el as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
      pendingScrollIdRef.current = null;
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id, searchAnchor?.id]);

  // Clear the search anchor when it becomes stale.
  useEffect(() => {
    setSearchAnchor(null);
  }, [statusFilters, departmentFilters, tagFilters, myOnly, selectedAgentId]);

  // Clear anchor if the user picks a different conversation.
  useEffect(() => {
    if (searchAnchor && selectedConversation && selectedConversation.id !== searchAnchor.id) {
      setSearchAnchor(null);
    }
  }, [selectedConversation?.id, searchAnchor]);

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

  // Load current client user ID. Resolution order:
  //   1. Direct match — caller's auth.users.id has a client_users row.
  //   2. Impersonation view_as_user — impersonating a SPECIFIC client user;
  //      resolve via client_users.user_id = activeSession.target_user_id.
  //   3. Impersonation full_access OR legacy preview-mode bridge — the caller
  //      acts on behalf of "any" client_user for the previewed client. We pick
  //      the deterministic earliest-created row so messages always attribute
  //      to the same human in this preview session.
  //
  // Waits for impersonation state to finish loading before falling through to
  // the preview-mode branch, so we don't fire the previewClient bridge race.
  useEffect(() => {
    const loadClientUser = async () => {
      if (!user?.id) return;
      if (impersonationLoading) return;

      try {
        // 1. Direct lookup
        const { data: directMatch, error: directError } = await supabase
          .from('client_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (directError) throw directError;

        if (directMatch) {
          setCurrentClientUserId(directMatch.id);
          console.log('[Handover] Client user ID (direct):', directMatch.id);
          return;
        }

        // 2. view_as_user impersonation — resolve to the specific target user's
        //    client_user row.
        if (isImpersonating && impersonationMode === 'view_as_user' && impersonationTargetUserId) {
          const { data: targetClientUser, error: targetError } = await supabase
            .from('client_users')
            .select('id')
            .eq('user_id', impersonationTargetUserId)
            .maybeSingle();

          if (targetError) throw targetError;

          if (targetClientUser) {
            setCurrentClientUserId(targetClientUser.id);
            console.log('[Handover] Client user ID (view_as_user):', targetClientUser.id);
            return;
          }
          console.warn('[Handover] view_as_user target has no client_users row:', impersonationTargetUserId);
        }

        // 3. Full-access impersonation OR legacy preview-mode bridge — pick the
        //    earliest client_user for the previewed client deterministically.
        const fallbackClientId =
          (isImpersonating && impersonationTargetClientId) ||
          (isClientPreviewMode && previewClient?.id) ||
          null;

        if (fallbackClientId) {
          const { data: previewUser, error: previewError } = await supabase
            .from('client_users')
            .select('id')
            .eq('client_id', fallbackClientId)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (previewError) throw previewError;

          if (previewUser) {
            setCurrentClientUserId(previewUser.id);
            console.log('[Handover] Client user ID (preview fallback):', previewUser.id);
            return;
          }
        }

        console.warn('[Handover] No client user ID found for current user');
      } catch (err) {
        console.error('[Handover] Failed to load client user:', err);
        toast({
          title: 'Could not load your user profile',
          description: 'Some handover actions may be unavailable. Try refreshing the page.',
          variant: 'destructive',
        });
      }
    };
    loadClientUser();
  }, [
    user?.id,
    isClientPreviewMode,
    previewClient,
    isImpersonating,
    impersonationMode,
    impersonationTargetUserId,
    impersonationTargetClientId,
    impersonationLoading,
    toast,
  ]);

  // Load pending handover conversation IDs for pinning
  useEffect(() => {
    if (!selectedAgentId) return;

    // Track whether we've already toasted in this effect-instance so realtime
    // re-fires don't spam the user.
    let warned = false;

    const loadPendingIds = async () => {
      const { data, error } = await supabase
        .from('handover_sessions')
        .select('conversation_id, created_at, takeover_type, departments:department_id(timeout_seconds)')
        .eq('status', 'pending');

      if (error) {
        console.error('[Handover] Failed to load pending session IDs:', error);
        if (!warned) {
          warned = true;
          toast({
            title: 'Pending handover list out of date',
            description: 'Refresh to see the latest pending requests.',
            variant: 'destructive',
          });
        }
        return;
      }

      if (data) {
        // Reset the warn flag on a successful refresh so transient blips can
        // re-toast next time they happen.
        warned = false;
        console.log('[pendingMeta] loaded', data.length, 'pending sessions');
        setPendingConversationIds(new Map(
          data
            .filter((d): d is typeof d & { created_at: string } => d.created_at !== null)
            .map(d => [d.conversation_id, {
              createdAt: d.created_at,
              takeoverType: (d as any).takeover_type === 'transfer' ? 'transfer' : 'handover',
              timeoutSeconds: ((d as any).departments?.timeout_seconds as number | undefined) || 300,
            }])
        ));
      }
    };
    loadPendingIds();

    const channel = supabase
      .channel('pending-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handover_sessions' }, (payload) => {
        loadPendingIds();
        // Play handover-request sound on a new pending session. Folded into
        // this channel because Supabase Realtime can drop one of two
        // subscriptions on the same table from the same client; the unfiltered
        // one (this) reliably fires.
        if (payload.eventType === 'INSERT' && (payload.new as any)?.status === 'pending') {
          const prefs = getSoundPreferences();
          if (prefs.handoverRequestEnabled) {
            playHandoverRequestSound(prefs.handoverRequestVolume);
          }
          if (prefs.browserNotifications) {
            sendBrowserNotification("New Handover Request", "A customer is requesting to speak with an agent");
          }
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [selectedAgentId, toast]);

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
        .select('id, speaker, text, buttons, timestamp, metadata, attachments')
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

  const addAdhocTag = async (label: string) => {
    if (!selectedConversation || updatingTags) return;
    const trimmed = label.trim();
    if (!trimmed) return;
    const newTags = assignedTags.includes(trimmed) ? assignedTags : [...assignedTags, trimmed];
    setUpdatingTags(true);
    try {
      await toggleTagMutation.mutateAsync({
        id: selectedConversation.id,
        metadata: selectedConversation.metadata,
        newTags,
      });
      setAssignedTags(newTags);
      setSelectedConversation(prev => prev ? { ...prev, metadata: { ...prev.metadata, tags: newTags } } : null);
      if (!availableTags.some(t => t.label.toLowerCase() === trimmed.toLowerCase())) {
        if (!selectedAgentId) return;
        const updatedTags = [...availableTags, { id: crypto.randomUUID(), label: trimmed }];
        await supabase.rpc('update_agent_config', {
          p_agent_id: selectedAgentId,
          p_config_updates: { conversation_tags: updatedTags },
        });
      }
      setTagSearchInput('');
      setTagDropdownOpen(false);
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

  const handleLeftPanelScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setShowLeftJumpToLatest(event.currentTarget.scrollTop > 200);
  };

  const jumpLeftPanelToLatest = () => {
    leftPanelScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setShowLeftJumpToLatest(false);
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

  // Same allowlist as supabase/functions/agent-file-upload/index.ts
  const AGENT_ATTACH_ALLOWED_MIME = new Set<string>([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip',
  ]);
  const AGENT_ATTACH_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  const AGENT_ATTACH_MAX_QUEUE = 5;

  const classifyAttachKind = (mimeType: string): 'image' | 'video' | 'audio' | 'file' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  };

  // Pick handler: validate and queue files for preview. NO upload yet.
  // The actual upload happens on Send (see handleSendChatMessage).
  const handleAgentAttach = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!selectedConversation) return;
    if (selectedConversation.status !== 'in_handover' || selectedConversation.owner_id !== currentClientUserId) {
      toast({ title: "Cannot attach", description: "Attachments only work during your active handover.", variant: "destructive" });
      return;
    }

    // Reset the input so picking the same file twice still fires onChange.
    const resetInput = () => { if (attachInputRef.current) attachInputRef.current.value = ''; };

    const remainingSlots = Math.max(0, AGENT_ATTACH_MAX_QUEUE - attachQueue.length);
    if (remainingSlots === 0) {
      toast({ title: "Too many files", description: `You can attach up to ${AGENT_ATTACH_MAX_QUEUE} files at a time.`, variant: "destructive" });
      resetInput();
      return;
    }

    const additions: AttachQueueEntry[] = [];
    const revokeAdditions = () => additions.forEach(a => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); });

    for (let i = 0; i < files.length && additions.length < remainingSlots; i++) {
      const f = files[i];
      if (f.size > AGENT_ATTACH_MAX_SIZE) {
        toast({ title: "File too large", description: `${f.name} is over 10MB.`, variant: "destructive" });
        revokeAdditions();
        resetInput();
        return;
      }
      if (!AGENT_ATTACH_ALLOWED_MIME.has(f.type)) {
        toast({ title: "File type not allowed", description: `${f.name} (${f.type || 'unknown'}) is not supported.`, variant: "destructive" });
        revokeAdditions();
        resetInput();
        return;
      }
      const kind = classifyAttachKind(f.type);
      const previewUrl = kind === 'image' ? URL.createObjectURL(f) : null;
      additions.push({
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        previewUrl,
        kind,
      });
    }

    if (additions.length === 0) {
      resetInput();
      return;
    }

    setAttachQueue(prev => [...prev, ...additions]);
    resetInput();
  };

  const removeFromAttachQueue = (id: string) => {
    setAttachQueue(prev => {
      const target = prev.find(e => e.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(e => e.id !== id);
    });
  };

  // canAttachInThisConversation gates BOTH the paperclip and the dropzone —
  // attachments are only valid during the agent's active handover.
  const canAttachInThisConversation = !!selectedConversation
    && selectedConversation.status === 'in_handover'
    && selectedConversation.owner_id === currentClientUserId;

  // Drag is "interesting" only if the dataTransfer contains files. Without
  // this check, dragging selected text or a link from elsewhere on the page
  // also flashes the overlay, which feels broken.
  const dragIsFiles = (e: React.DragEvent<HTMLDivElement>): boolean => {
    const types = e.dataTransfer?.types;
    if (!types) return false;
    // types is a DOMStringList, not a JS array, so iterate manually.
    for (let i = 0; i < types.length; i++) {
      if (types[i] === 'Files') return true;
    }
    return false;
  };

  const handleTranscriptDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canAttachInThisConversation) return;
    if (attachUploading || sendingMessage) return;
    if (!dragIsFiles(e)) return;
    e.preventDefault();
    // relatedTarget is null when entering from outside the browser, or the
    // element we left when moving between children. If it's a child of the
    // panel, we're already inside — no state change needed.
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setIsDraggingFile(true);
    // Probe MIME types if the browser exposes them on enter (Safari often
    // doesn't — we re-check on drop anyway). This just lets us flash the
    // red invalid state proactively.
    let invalid = false;
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind !== 'file') continue;
        if (it.type && !AGENT_ATTACH_ALLOWED_MIME.has(it.type)) {
          invalid = true;
          break;
        }
      }
    }
    setDragInvalid(invalid);
  };

  const handleTranscriptDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canAttachInThisConversation) return;
    if (attachUploading || sendingMessage) return;
    if (!dragIsFiles(e)) return;
    // Required to allow drop. Without preventDefault on dragover, the drop
    // event won't fire — the OS will handle the file as a navigation instead.
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = dragInvalid ? 'none' : 'copy';
    }
  };

  const handleTranscriptDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!isDraggingFile) return;
    const related = e.relatedTarget as Node | null;
    // Moving between children of the panel — still inside, do nothing.
    if (related && e.currentTarget.contains(related)) return;
    setIsDraggingFile(false);
    setDragInvalid(false);
  };

  const handleTranscriptDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!canAttachInThisConversation) return;
    e.preventDefault();
    const wasInvalid = dragInvalid;
    setIsDraggingFile(false);
    setDragInvalid(false);
    if (wasInvalid) return;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleAgentAttach(files);
    }
  };

  // Failsafe — if a drag ends outside the panel (user drops on the page bg,
  // hits ESC, or alt-tabs away), the dragleave on our panel may never fire,
  // leaving the overlay stuck on. Window-level dragend/drop always fire.
  useEffect(() => {
    if (!isDraggingFile) return;
    const reset = () => {
      setIsDraggingFile(false);
      setDragInvalid(false);
    };
    window.addEventListener('dragend', reset);
    window.addEventListener('drop', reset);
    return () => {
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop', reset);
    };
  }, [isDraggingFile]);

  const handleSendChatMessage = async () => {
    const messageText = chatMessage.trim();
    const queued = attachQueue;
    if (!messageText && queued.length === 0) return;
    if (sendingMessage || attachUploading) return;
    if (!selectedConversation) return;

    // ---- Path A: queue empty -> text-only via handover-actions (legacy path) ----
    if (queued.length === 0) {
      setChatMessage("");
      setSendingMessage(true);
      try {
        const { data, error } = await supabase.functions.invoke('handover-actions', {
          body: {
            action: 'send_message',
            conversationId: selectedConversation.id,
            clientUserId: currentClientUserId,
            clientUserName: profile?.full_name || (profile as any)?.first_name || 'Agent',
            message: messageText,
          },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Failed to send');
      } catch (err: any) {
        toast({ title: "Error", description: err.message || 'Failed to send message', variant: "destructive" });
        setChatMessage(messageText);
      } finally {
        setSendingMessage(false);
      }
      return;
    }

    // ---- Path B: queue has files -> drain via agent-file-upload ----
    // Caption attaches to the FIRST file's transcript bubble; subsequent files
    // commit with empty text. Mirrors the widget multi-file send semantics.
    // Direct fetch (not supabase.functions.invoke) because invoke serialises
    // the body as JSON, which clobbers multipart FormData and makes the edge
    // function reject "Missing fields". With direct fetch the browser sets
    // Content-Type with the right multipart boundary.
    if (!currentClientUserId) {
      toast({ title: "Cannot send", description: "Could not resolve your agent identity — try refreshing.", variant: "destructive" });
      return;
    }
    setChatMessage("");
    setAttachUploading(true);
    setSendingMessage(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated — please re-login.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const url = `${supabaseUrl}/functions/v1/agent-file-upload`;

      for (let i = 0; i < queued.length; i++) {
        const entry = queued[i];
        const form = new FormData();
        form.append('file', entry.file);
        form.append('conversationId', selectedConversation.id);
        form.append('clientUserId', currentClientUserId);
        // Caption only on the first file
        form.append('text', i === 0 ? messageText : '');

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: anonKey,
          },
          body: form,
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body?.success) {
          throw new Error(body?.message || body?.error || `Upload failed (${res.status})`);
        }
        // On per-file success, revoke its object URL and remove from queue so
        // partial-failure leaves only un-sent files visible for retry.
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
        setAttachQueue(prev => prev.filter(e => e.id !== entry.id));
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || 'Could not send attachment', variant: "destructive" });
      // Restore caption so the user can retry without retyping
      setChatMessage(messageText);
    } finally {
      setAttachUploading(false);
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

  const handleArchiveConversation = async () => {
    if (!selectedConversation?.id) return;
    setArchiving(true);
    try {
      const { error } = await supabase.rpc('set_conversation_archived', {
        p_conversation_id: selectedConversation.id,
        p_archived: true,
      });
      if (error) {
        if ((error as any).code === '42501') {
          toast({
            title: "Only admins can archive conversations",
            description: "Ask your admin to do this.",
            variant: "destructive",
          });
        } else if ((error as any).code === '42704') {
          toast({ title: "Conversation not found", variant: "destructive" });
        } else {
          toast({
            title: "Failed to archive",
            description: error.message ?? "Please try again.",
            variant: "destructive",
          });
        }
        return;
      }
      setArchiveConfirmOpen(false);
      setSelectedConversation(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({ title: "Conversation archived" });
    } finally {
      setArchiving(false);
    }
  };

  const handleTakeover = async () => {
    setTakeoverConfirmOpen(false);
    await callHandoverAction('take_over');
  };

  // Read tags from top-level config.conversation_tags, fall back to legacy widget_settings path
  const availableTags: Array<{ id: string; label: string }> = (
    (agentConfig as any)?.conversation_tags ||
    (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.map((t: any) => ({ id: t.id, label: t.label })) ||
    []
  );
  const allowAdhocTags: boolean = (agentConfig as any)?.allow_adhoc_tags ?? false;
  const tagsEnabled: boolean = (agentConfig as any)?.tags_enabled ?? true;

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
    if (tagsEnabled && tagFilters.length > 0) {
      result = result.filter(c =>
        tagFilters.some(tag => c.metadata?.tags?.includes(tag))
      );
    }
    if (myOnly && currentClientUserId) {
      result = result.filter(c => c.owner_id === currentClientUserId);
    }
    // Pin priority:
    //   Tier 1 = handover/transfer requests (pending session) OR status=waiting
    //   Tier 2 = in_handover with an unanswered customer message
    //   Tier 3 = everything else
    // Within Tier 1, oldest wait first so the longest-waiting customer is on top.
    const waitStart = (c: typeof result[number]): number => {
      const pendingMeta = pendingConversationIds.get(c.id);
      if (pendingMeta?.createdAt) return new Date(pendingMeta.createdAt).getTime();
      if (c.first_unanswered_message_at) return new Date(c.first_unanswered_message_at).getTime();
      return Date.now();
    };
    result = [...result].sort((a, b) => {
      const aTier = (pendingConversationIds.has(a.id) || a.status === 'waiting') ? 1
        : (a.status === 'in_handover' && a.first_unanswered_message_at) ? 2
        : 3;
      const bTier = (pendingConversationIds.has(b.id) || b.status === 'waiting') ? 1
        : (b.status === 'in_handover' && b.first_unanswered_message_at) ? 2
        : 3;
      if (aTier !== bTier) return aTier - bTier;
      if (aTier === 1) return waitStart(a) - waitStart(b);
      return 0;
    });
    // Inject search anchor at the top when the searched conversation lives
    // outside the natural list. Hidden automatically once the real row arrives
    // via fetchNextPage (the some() guard de-duplicates).
    if (searchAnchor && !result.some(c => c.id === searchAnchor.id)) {
      return [searchAnchor, ...result];
    }
    return result;
  }, [conversations, tagFilters, departmentFilters, pendingConversationIds, myOnly, currentClientUserId, tagsEnabled, searchAnchor]);

  const allSelected = filteredConversations.length > 0 &&
    filteredConversations.every(c => selectedConversationIds.has(c.id));

  

  const responseThresholds = (agentConfig as any)?.response_thresholds;

  const getWaitSeconds = (conversation: any) => {
    if (!conversation.first_unanswered_message_at) return 0;
    return Math.floor((Date.now() - new Date(conversation.first_unanswered_message_at).getTime()) / 1000);
  };


  if (agents.length === 0) {
    return <NoAgentsAssigned />;
  }

  // "Mine" only has a meaningful subject when the viewer is acting as a real
  // client user — direct client login, or an impersonation session that is
  // explicitly view-as-user. Full-access impersonation / preview-as-client has
  // no single owner to filter by, so the toggle is disabled with a tooltip.
  const canUseMineFilter =
    userType === 'client' ||
    (isImpersonating && impersonationMode === 'view_as_user');

  type PinnableRow = 'status' | 'department' | 'tags';
  const forcedPins = (agentConfig as any)?.force_pinned_filter_rows ?? {};
  const isForced = (row: PinnableRow): boolean => forcedPins[row] === true;
  const isRowVisible = (row: PinnableRow): boolean => {
    if (row === 'department' && departments.length <= 1) return false;
    if (row === 'tags' && (!tagsEnabled || availableTags.length === 0)) return false;
    return isForced(row) || pinnedRows[row] || filtersExpanded;
  };
  const togglePin = (row: PinnableRow) => {
    if (isForced(row)) return;
    setPinnedRows(p => ({ ...p, [row]: !p[row] }));
  };

  const PinToggle = ({ row }: { row: PinnableRow }) => {
    const locked = isForced(row);
    return (
      <Button
        size="icon"
        variant="ghost"
        onClick={() => togglePin(row)}
        disabled={locked}
        className="h-6 w-6 shrink-0"
        title={
          locked
            ? 'Pinned by admin (locked)'
            : pinnedRows[row]
              ? 'Unpin row (hide when filters collapsed)'
              : 'Pin row (always show)'
        }
        aria-label={locked ? `${row} filters locked by admin` : (pinnedRows[row] ? `Unpin ${row} filters` : `Pin ${row} filters`)}
        aria-pressed={locked || pinnedRows[row]}
      >
        {locked
          ? <Lock className="h-3 w-3 opacity-60" />
          : pinnedRows[row]
            ? <Pin className="h-3 w-3 fill-current" />
            : <PinOff className="h-3 w-3 opacity-60" />
        }
      </Button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Unified header ── */}
      <div className="bg-card flex-shrink-0 border-b border-border pb-3">
        {/* Row 1: Mine toggle + Title + count */}
        <div className="px-4 pt-3 pb-0 flex items-center gap-2">
          <Button
            size="icon"
            variant={myOnly ? 'default' : 'ghost'}
            onClick={() => setMyOnly(v => !v)}
            disabled={!canUseMineFilter || !currentClientUserId}
            className="h-7 w-7"
            title={
              canUseMineFilter
                ? (myOnly ? 'Showing only conversations assigned to me' : 'Show only conversations assigned to me')
                : 'Switch to view-as-user mode to use this filter'
            }
            aria-label="Show only my conversations"
            aria-pressed={myOnly}
          >
            <UserCheck className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant={filtersExpanded ? 'default' : 'ghost'}
            onClick={() => setFiltersExpanded(v => !v)}
            className="h-7 w-7"
            title={filtersExpanded ? 'Hide unpinned filter rows' : 'Show all filter rows'}
            aria-label="Toggle filter rows"
            aria-pressed={filtersExpanded}
            aria-expanded={filtersExpanded}
          >
            <Filter className="h-3.5 w-3.5" />
          </Button>
          <h1 className="text-lg font-semibold">Conversations</h1>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded border">
            {filteredConversations.length}
          </span>
        </div>

        {/* Row 2: Status filters (multi-select toggle) */}
        {isRowVisible('status') && (
        <div className="px-4 py-1.5 flex items-center gap-1">
          {filtersExpanded && <PinToggle row="status" />}
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
        )}

        {/* Row 2b: Department filters (multi-select toggle, hidden for single department) */}
        {isRowVisible('department') && (
          <div className="px-4 py-1.5 flex items-center gap-1.5 flex-wrap">
            {filtersExpanded && <PinToggle row="department" />}
            <button
              onClick={() => setDepartmentFilters([])}
              className={cn(
                "h-7 text-xs px-3 font-medium inline-flex items-center rounded-full border transition-colors",
                departmentFilters.length === 0
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50"
              )}
            >
              All ({conversations.length})
            </button>
            {departments.map(dept => {
              const count = departmentCounts.get(dept.id) || 0;
              const isActive = departmentFilters.includes(dept.id);
              const color = dept.color || '#6B7280';
              return (
                <button
                  key={dept.id}
                  onClick={() => {
                    setDepartmentFilters(prev => {
                      const next = isActive ? prev.filter(x => x !== dept.id) : [...prev, dept.id];
                      return next.length === departments.length ? [] : next;
                    });
                  }}
                  className={cn(
                    "h-7 text-xs px-3 font-medium inline-flex items-center rounded-full border transition-colors",
                    count === 0 && !isActive && "opacity-40"
                  )}
                  style={isActive ? {
                    backgroundColor: `${color}25`,
                    borderColor: color,
                    color: color,
                  } : {
                    backgroundColor: `${color}15`,
                    borderColor: `${color}40`,
                    color: color,
                  }}
                >
                  {dept.name} ({count})
                </button>
              );
            })}
          </div>
        )}
        {/* Row 3: Tag filter chips — hidden when no tags exist or tags disabled */}
        {isRowVisible('tags') && (
          <div className="px-4 py-1.5 flex items-center gap-1.5 flex-wrap">
            {filtersExpanded && <PinToggle row="tags" />}
            {tagFilters.length > 0 && (
              <button
                onClick={() => setTagFilters([])}
                className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            {tagFilters.map(tf => (
              <button
                key={tf}
                onClick={() => toggleTagFilter(tf)}
                className="text-xs px-2 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground flex items-center gap-1 font-medium"
              >
                {tf}
                <X className="w-2.5 h-2.5 opacity-50" />
              </button>
            ))}
            {availableTags.filter((t: any) => !tagFilters.includes(t.label)).map((tag: any) => (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.label)}
                className="text-xs px-2 py-0.5 rounded border border-dashed border-border/50 text-muted-foreground/60 hover:text-muted-foreground hover:border-border transition-colors"
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Three-panel workspace ── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-[320px_minmax(300px,1fr)_340px] h-full">

          {/* LEFT PANEL: Conversation list */}
          <div className="flex flex-col border-r border-border h-full overflow-hidden relative">

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

                {tagsEnabled && availableTags.length > 0 && (
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
            <ScrollArea
              className="flex-1"
              viewportRef={leftPanelScrollRef}
              onViewportScroll={handleLeftPanelScroll}
            >
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
                    const pendingMeta = pendingConversationIds.get(conv.id) || null;
                    return (
                      <ConversationCard
                        key={conv.id}
                        conversation={conv}
                        departments={departments}
                        tagsEnabled={tagsEnabled}
                        currentClientUserId={currentClientUserId}
                        isSelected={isSelected}
                        isChecked={isChecked}
                        pendingMeta={pendingMeta}
                        selectedConversationLive={selectedConversation as any}
                        responseThresholds={responseThresholds}
                        onClick={() => setSelectedConversation(conv)}
                        onCheckChange={(checked) => {
                          setSelectedConversationIds(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(conv.id); else next.delete(conv.id);
                            return next;
                          });
                        }}
                      />
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

            {showLeftJumpToLatest && (
              <Button
                className="absolute top-2 left-1/2 -translate-x-1/2 shadow-lg z-10 h-7 px-3 text-xs"
                size="sm"
                onClick={jumpLeftPanelToLatest}
              >
                <ArrowUp className="h-3 w-3 mr-1" />
                Jump to latest
              </Button>
            )}
          </div>

          {/* MIDDLE PANEL: Transcript */}
          <div
            className="flex flex-col border-r border-border h-full overflow-hidden relative bg-muted/30"
            onDragEnter={handleTranscriptDragEnter}
            onDragOver={handleTranscriptDragOver}
            onDragLeave={handleTranscriptDragLeave}
            onDrop={handleTranscriptDrop}
          >
            {/* Drag-and-drop overlay — covers the panel while dragging files
                in. Pointer-events:none so events still hit the panel below
                (otherwise the overlay would steal dragleave events). */}
            {isDraggingFile && canAttachInThisConversation && (
              <div
                className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none rounded-md transition-colors ${
                  dragInvalid ? 'bg-destructive/30' : 'bg-primary/15 backdrop-blur-[2px]'
                }`}
              >
                <div
                  className={`flex flex-col items-center gap-2 px-6 py-5 rounded-lg border-2 border-dashed ${
                    dragInvalid
                      ? 'border-destructive text-destructive bg-background/95'
                      : 'border-primary text-primary bg-background/95'
                  }`}
                >
                  {dragInvalid ? <X className="h-7 w-7" /> : <Paperclip className="h-7 w-7" />}
                  <span className="text-sm font-medium">
                    {dragInvalid ? 'Unsupported file type' : 'Drop to attach'}
                  </span>
                </div>
              </div>
            )}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {departments.length > 1 && selectedConversation.department_id && (() => {
                      const dept = departments.find(d => d.id === selectedConversation.department_id);
                      return dept ? (
                        <span
                          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border"
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => setArchiveConfirmOpen(true)}
                      title="Archive conversation"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                          // Hide user button-click messages. In the widget the
                          // selection is reflected by ringing the chosen button
                          // on the prior assistant bubble, not a separate user
                          // message — mirror that here.
                          if (transcript.speaker === 'user' && transcript.metadata?.button_click) {
                            return null;
                          }

                          const prevTranscript = index > 0 ? transcripts[index - 1] : null;
                          const showSeparator =
                            index === 0 ||
                            (prevTranscript &&
                              !isSameDay(new Date(prevTranscript.timestamp), new Date(transcript.timestamp)));
                          const separatorEl = showSeparator ? (
                            <div className="text-center text-xs text-muted-foreground my-3">
                              {format(new Date(transcript.timestamp), 'do MMMM yyyy')}
                            </div>
                          ) : null;
                          const fragKey = transcript.id || `idx-${index}`;

                          // System messages render as centered indicators
                          if (transcript.speaker === 'system') {
                            if (!transcript.text?.trim()) return null; // Don't render empty system messages
                            return (
                              <Fragment key={fragKey}>
                                {separatorEl}
                                <div className="flex justify-center my-3">
                                  <div className="bg-muted text-muted-foreground text-xs px-3 py-1 rounded-full border border-border">
                                    {transcript.text}
                                  </div>
                                </div>
                              </Fragment>
                            );
                          }

                          // Client user messages render with name label and distinct style
                          if (transcript.speaker === 'client_user') {
                            const name = transcript.metadata?.client_user_name || 'Agent';
                            const atts = transcript.attachments;
                            const hasText = !!transcript.text?.trim();
                            // File-only message: the bg-muted file tile chip is its own
                            // visual; nesting it inside a bg-card bordered bubble created
                            // an unintended "double border" + made the filename inherit
                            // the bubble's text color. Collapse the bubble and let the
                            // chip stand alone.
                            const onlyFileAttachments =
                              !hasText &&
                              !!atts && atts.length > 0 &&
                              atts.every((a: any) => a.kind === 'file');
                            return (
                              <Fragment key={fragKey}>
                                {separatorEl}
                                <div className="flex gap-2 mb-4">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-primary">
                                  {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-[11px] font-medium text-primary mb-0.5 block">{name}</span>
                                  <div
                                    className={
                                      onlyFileAttachments
                                        ? 'text-sm max-w-[400px] w-fit'
                                        : `bg-card border border-border rounded-xl rounded-tl-sm text-sm max-w-[400px] w-fit ${hasText ? 'px-3 py-2' : 'p-1'}`
                                    }
                                  >
                                    {hasText && <div className="whitespace-pre-wrap">{transcript.text}</div>}
                                    {atts && atts.length > 0 && atts.map((att: any, idx: number) => {
                                      if (att.kind === 'image') {
                                        return (
                                          <a key={idx} href={att.url} target="_blank" rel="noreferrer" className="block mt-2 first:mt-0">
                                            <img src={att.url} alt={att.fileName} className="max-w-full max-h-[260px] rounded-lg cursor-pointer object-cover" />
                                          </a>
                                        );
                                      }
                                      if (att.kind === 'video') {
                                        return <video key={idx} src={att.url} controls preload="metadata" className="max-w-full max-h-[260px] rounded-lg mt-2 first:mt-0 block bg-black" />;
                                      }
                                      if (att.kind === 'audio') {
                                        return <audio key={idx} src={att.url} controls preload="metadata" className="w-full mt-2 first:mt-0 block" />;
                                      }
                                      // File / document tile — explicit colors so the
                                      // filename stays legible whether nested or not.
                                      // Append ?download= so Supabase serves with
                                      // Content-Disposition: attachment (HTML `download`
                                      // attr is ignored cross-origin).
                                      const sizeLabel = formatBytes(att.size || 0);
                                      return (
                                        <a
                                          key={idx}
                                          href={withDownloadParam(att.url, att.fileName)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-2.5 p-2 mt-2 first:mt-0 bg-muted hover:bg-muted/80 rounded-lg transition-colors no-underline max-w-[280px]"
                                        >
                                          <div className="w-9 h-9 rounded-md bg-background border border-border flex items-center justify-center flex-shrink-0">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                          </div>
                                          <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-xs font-medium truncate text-foreground">{att.fileName}</span>
                                            {sizeLabel && <span className="text-[10px] text-muted-foreground">{sizeLabel}</span>}
                                          </div>
                                          <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                        </a>
                                      );
                                    })}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{format(new Date(transcript.timestamp), 'h:mm a · d/M')}</span>
                                </div>
                              </div>
                              </Fragment>
                            );
                          }

                          // User and assistant messages use the existing MessageBubble.
                          // Mirror the widget: keep the buttons visible on the
                          // assistant message and ring the chosen one. The user's
                          // button-click "bubble" is hidden (handled by the early
                          // return at the top of this map).
                          const speaker = transcript.speaker === 'user' ? 'user' : 'assistant';
                          const nextTranscript = transcripts[index + 1];
                          const selectedButton =
                            nextTranscript?.speaker === 'user' && nextTranscript?.metadata?.button_click
                              ? nextTranscript.text
                              : undefined;
                          return (
                            <Fragment key={fragKey}>
                              {separatorEl}
                              <MessageBubble
                                text={transcript.text}
                                speaker={speaker}
                                timestamp={transcript.timestamp}
                                buttons={transcript.buttons}
                                selectedButton={selectedButton}
                                attachments={transcript.attachments}
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
                            </Fragment>
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
                  const { color } = getResponseTimeColor(waitSec, responseThresholds);
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
                    <div className="flex flex-col gap-2">
                      {/* Pending attachment preview row — shown above the input
                          bar while files are queued. Each tile has its own ×
                          to remove just that file from the pending list. */}
                      {attachQueue.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {attachQueue.map(entry => (
                            <div
                              key={entry.id}
                              className="relative flex items-center gap-2 bg-muted rounded-lg p-1.5 pr-7 max-w-[220px]"
                            >
                              {entry.kind === 'image' && entry.previewUrl ? (
                                <img
                                  src={entry.previewUrl}
                                  alt={entry.file.name}
                                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-medium truncate">{entry.file.name}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {entry.file.size < 1024
                                    ? `${entry.file.size} B`
                                    : entry.file.size < 1024 * 1024
                                      ? `${(entry.file.size / 1024).toFixed(0)} KB`
                                      : `${(entry.file.size / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromAttachQueue(entry.id)}
                                disabled={attachUploading}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background border border-border flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                title="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                      {/* Canned responses button — hidden entirely when agency has feature off */}
                      {cannedResponsesEnabled && (
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
                      )}
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
                      <input
                        ref={attachInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/zip"
                        onChange={(e) => handleAgentAttach(e.target.files)}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="shrink-0"
                        onClick={() => attachInputRef.current?.click()}
                        disabled={attachUploading || sendingMessage || attachQueue.length >= AGENT_ATTACH_MAX_QUEUE}
                        title={attachQueue.length >= AGENT_ATTACH_MAX_QUEUE ? `Up to ${AGENT_ATTACH_MAX_QUEUE} files at a time` : "Attach file"}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Input
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder={attachQueue.length > 0 ? "Add a caption (optional)..." : "Type a message..."}
                        className="flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage();
                          }
                        }}
                        disabled={sendingMessage || attachUploading}
                      />
                      <Button
                        size="icon"
                        onClick={handleSendChatMessage}
                        disabled={sendingMessage || attachUploading || (!chatMessage.trim() && attachQueue.length === 0)}
                      >
                        {(sendingMessage || attachUploading) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                      </div>
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
                            {(() => {
                              const maxSec = pendingSession.departments?.timeout_seconds || 300;
                              const waitSec = Math.floor((Date.now() - new Date(pendingSession.created_at).getTime()) / 1000);
                              const { color } = getResponseTimeColor(waitSec, responseThresholds);
                              return (
                                <div className="flex items-center gap-1 text-xs" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                                  <Timer className="h-3 w-3" />
                                  {formatWaitTime(waitSec)} / {formatWaitTime(maxSec)}
                                </div>
                              );
                            })()}
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
                              className="flex-1 text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
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
                                className="w-full p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors text-left"
                              >
                                <div className="flex items-center justify-between">
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
                                        : conv.status === 'resolved' ? `Resolved${conv.resolution_reason ? ` — ${conv.resolution_reason}` : ''}`
                                        : conv.status}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                                    {conv.last_activity_at ? new Date(conv.last_activity_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                                  </span>
                                </div>
                                {conv.department_id && (() => {
                                  const dept = departments.find(d => d.id === conv.department_id);
                                  return dept ? (
                                    <div className="flex items-center gap-1 mt-1 pl-[14px]">
                                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: dept.color || '#6B7280' }} />
                                      <span className="text-[10px] text-muted-foreground">{dept.name}</span>
                                    </div>
                                  ) : null;
                                })()}
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

                    {tagsEnabled && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tags</p>
                      {/* Applied tags as grey pills */}
                      {assignedTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {assignedTags.map((tag: string) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground"
                            >
                              {tag}
                              <button
                                onClick={() => toggleTag(tag)}
                                disabled={updatingTags}
                                className="hover:text-foreground transition-colors"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Autocomplete input */}
                      <div className="relative">
                        <Input
                          value={tagSearchInput}
                          onChange={(e) => {
                            setTagSearchInput(e.target.value);
                            setTagDropdownOpen(true);
                          }}
                          onFocus={() => setTagDropdownOpen(true)}
                          onBlur={() => setTimeout(() => setTagDropdownOpen(false), 200)}
                          placeholder="Search or create tag..."
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && tagSearchInput.trim()) {
                              e.preventDefault();
                              const exactMatch = availableTags.find(t => t.label.toLowerCase() === tagSearchInput.trim().toLowerCase());
                              if (exactMatch) {
                                toggleTag(exactMatch.label);
                                setTagSearchInput('');
                                setTagDropdownOpen(false);
                              } else if (allowAdhocTags) {
                                addAdhocTag(tagSearchInput.trim());
                              }
                            }
                            if (e.key === 'Escape') {
                              setTagSearchInput('');
                              setTagDropdownOpen(false);
                            }
                          }}
                        />
                        {tagDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-md shadow-sm z-20 max-h-48 overflow-y-auto">
                            {availableTags
                              .filter(t => !assignedTags.includes(t.label))
                              .filter(t => !tagSearchInput.trim() || t.label.toLowerCase().includes(tagSearchInput.trim().toLowerCase()))
                              .map(tag => (
                                <button
                                  key={tag.id}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    toggleTag(tag.label);
                                    setTagSearchInput('');
                                    setTagDropdownOpen(false);
                                  }}
                                >
                                  {tag.label}
                                </button>
                              ))}
                            {tagSearchInput.trim() && !availableTags.some(t => t.label.toLowerCase() === tagSearchInput.trim().toLowerCase()) && allowAdhocTags && (
                              <button
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors border-t border-border text-muted-foreground"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => addAdhocTag(tagSearchInput.trim())}
                              >
                                + Create "{tagSearchInput.trim()}"
                              </button>
                            )}
                            {availableTags.filter(t => !assignedTags.includes(t.label)).filter(t => !tagSearchInput.trim() || t.label.toLowerCase().includes(tagSearchInput.trim().toLowerCase())).length === 0 && !(tagSearchInput.trim() && allowAdhocTags) && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                {availableTags.length === 0 ? 'No tags configured' : 'No matching tags'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    )}

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
            <Button
              variant="outline"
              className="text-yellow-700 border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700 dark:text-yellow-400 dark:border-yellow-800 dark:hover:bg-yellow-950/30 dark:hover:text-yellow-400"
              onClick={() => handleEndHandover(false)}
            >
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

      {/* Archive Confirmation (N8) */}
      <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will end the conversation and remove it from your inbox. You can find it again in Transcripts → Include archived. Admin permission is required.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConversation} disabled={archiving}>
              {archiving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
