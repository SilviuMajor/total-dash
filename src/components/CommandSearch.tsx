import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Users,
  Bot,
  Building2,
  Clock,
  CalendarDays,
  X,
  RotateCcw,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useAgentConfig } from "@/hooks/queries/useAgentConfig";
import { useClientDepartments } from "@/hooks/useClientDepartments";
import { ConversationCard, type CardConversation } from "@/components/conversations/ConversationCard";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

type SearchCategory = "conversation" | "transcript" | "client" | "agent" | "agency";

interface SearchResult {
  id: string;
  category: SearchCategory;
  label: string;
  sublabel?: string;
  href: string;
  Icon: LucideIcon;
  // Client-mode conversation extras
  conversation?: CardConversation;
  matchedField?: string | null;
  matchPrefix?: string | null;
  matchHit?: string | null;
  matchSuffix?: string | null;
}

const RECENT_KEY = "search_recent";
const ACTIVE_FILTERS_KEY = "totaldash_conversations_active_filters";

interface ActiveFilters {
  statusFilters: string[];
  tagFilters: string[];
  departmentFilters: string[];
  myOnly: boolean;
}

function readActiveFilters(): ActiveFilters {
  try {
    const raw = sessionStorage.getItem(ACTIVE_FILTERS_KEY);
    if (!raw) return { statusFilters: [], tagFilters: [], departmentFilters: [], myOnly: false };
    const parsed = JSON.parse(raw);
    return {
      statusFilters: Array.isArray(parsed.statusFilters) ? parsed.statusFilters : [],
      tagFilters: Array.isArray(parsed.tagFilters) ? parsed.tagFilters : [],
      departmentFilters: Array.isArray(parsed.departmentFilters) ? parsed.departmentFilters : [],
      myOnly: !!parsed.myOnly,
    };
  } catch {
    return { statusFilters: [], tagFilters: [], departmentFilters: [], myOnly: false };
  }
}

function getRecent(): SearchResult[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: SearchResult) {
  try {
    // Strip the heavy `conversation` blob before saving — recents only need the lightweight fields.
    const slim: SearchResult = {
      id: item.id,
      category: item.category,
      label: item.label,
      sublabel: item.sublabel,
      href: item.href,
      Icon: item.Icon,
    };
    const existing = getRecent().filter((r) => r.id !== slim.id);
    const next = [slim, ...existing].slice(0, 5);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function getPlaceholder(mode: string): string {
  if (mode === "client") return "Search conversations and transcripts...";
  if (mode === "agency") return "Search clients and agents...";
  return "Search agencies...";
}

function getSearchMode(
  userType: string | null,
  previewDepth: string
): "client" | "agency" | "admin" {
  if (previewDepth === "agency_to_client" || previewDepth === "client") return "client";
  if (previewDepth === "agency" || userType === "agency") return "agency";
  if (userType === "super_admin") return "admin";
  return "client";
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "with_ai", label: "With AI" },
  { value: "waiting", label: "Waiting" },
  { value: "in_handover", label: "In Handover" },
  { value: "aftercare", label: "Aftercare" },
  { value: "needs_review", label: "Needs Review" },
  { value: "resolved", label: "Resolved" },
];

type DatePreset = "all" | "today" | "7d" | "30d" | "custom";

function presetToRange(preset: DatePreset, customRange?: DateRange): { start: Date | null; end: Date | null; label: string } {
  if (preset === "all") return { start: null, end: null, label: "All time" };
  if (preset === "today") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, end: null, label: "Today" };
  }
  if (preset === "7d") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 6);
    return { start, end: null, label: "Last 7 days" };
  }
  if (preset === "30d") {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);
    return { start, end: null, label: "Last 30 days" };
  }
  if (preset === "custom" && customRange?.from) {
    const start = new Date(customRange.from);
    start.setHours(0, 0, 0, 0);
    let end: Date | null = null;
    let label = format(start, "MMM d");
    if (customRange.to) {
      end = new Date(customRange.to);
      end.setHours(23, 59, 59, 999);
      label = `${format(start, "MMM d")} – ${format(end, "MMM d")}`;
    }
    return { start, end, label };
  }
  return { start: null, end: null, label: "All time" };
}

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  // Dialog-side filter state (mirror of dashboard, scratch space — does NOT push back).
  const [dialogStatuses, setDialogStatuses] = useState<string[]>([]);
  const [dialogDepartments, setDialogDepartments] = useState<string[]>([]);
  const [dialogTags, setDialogTags] = useState<string[]>([]);
  const [dialogMyOnly, setDialogMyOnly] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const dateRange = useMemo(
    () => presetToRange(datePreset, customDateRange),
    [datePreset, customDateRange]
  );

  const navigate = useNavigate();
  const { userType, previewDepth, profile } = useMultiTenantAuth();
  const { selectedAgentId, agents } = useClientAgentContext();
  const { isImpersonating, impersonationMode } = useImpersonation();
  const { data: agentConfig } = useAgentConfig(selectedAgentId);
  const { departments } = useClientDepartments();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentClientUserId, setCurrentClientUserId] = useState<string | null>(null);

  const searchMode = getSearchMode(userType, previewDepth);
  const tagsEnabled: boolean = (agentConfig as any)?.tags_enabled ?? true;
  const availableTags: Array<{ id: string; label: string }> =
    (agentConfig as any)?.conversation_tags ||
    (agentConfig as any)?.widget_settings?.functions?.conversation_tags?.map((t: any) => ({
      id: t.id,
      label: t.label,
    })) ||
    [];
  const responseThresholds = (agentConfig as any)?.response_thresholds;
  const canUseMineFilter =
    userType === "client" ||
    (isImpersonating && impersonationMode === "view_as_user");

  // Resolve currentClientUserId for the My-only toggle (matches Conversations.tsx logic, but
  // simplified: we only need it when canUseMineFilter is true and dialogMyOnly is on).
  useEffect(() => {
    if (!canUseMineFilter) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && data) setCurrentClientUserId(data.id);
    })();
    return () => { cancelled = true; };
  }, [canUseMineFilter]);

  // Snap dialog filters from dashboard sessionStorage on open.
  const seedFromDashboard = useCallback(() => {
    const f = readActiveFilters();
    setDialogStatuses(f.statusFilters);
    setDialogDepartments(f.departmentFilters);
    setDialogTags(f.tagFilters);
    setDialogMyOnly(f.myOnly);
  }, []);

  // Load recent + seed dialog filters on open
  useEffect(() => {
    if (open) {
      setRecentItems(getRecent());
      setQuery("");
      setResults([]);
      seedFromDashboard();
      setDatePreset("all");
      setCustomDateRange(undefined);
    }
  }, [open, seedFromDashboard]);

  // Keyboard + custom event listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    const handleCustomEvent = () => setOpen(true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-search", handleCustomEvent);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-search", handleCustomEvent);
    };
  }, []);

  const hasAnyFilter =
    dialogStatuses.length > 0 ||
    dialogDepartments.length > 0 ||
    dialogTags.length > 0 ||
    dialogMyOnly ||
    !!dateRange.start ||
    !!dateRange.end;

  // Debounced search
  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      const hasUsableQuery = trimmed.length >= 3;
      const onlyEmpty = !trimmed && !hasAnyFilter;
      if (onlyEmpty) {
        setResults([]);
        setLoading(false);
        return;
      }
      // 1- or 2-char query with no filters: show nothing (matches the trgm gate).
      if (trimmed.length > 0 && !hasUsableQuery && !hasAnyFilter) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const found: SearchResult[] = [];

      try {
        if (searchMode === "admin") {
          const { data } = await supabase
            .from("agencies")
            .select("id, name, slug")
            .ilike("name", `%${trimmed}%`)
            .is("deleted_at", null)
            .order("name")
            .limit(8);

          (data || []).forEach((a) => {
            found.push({
              id: a.id,
              category: "agency",
              label: a.name,
              sublabel: a.slug,
              href: `/admin/agencies/${a.id}`,
              Icon: Building2,
            });
          });
        } else if (searchMode === "agency") {
          const agencyId = profile?.agency?.id;
          if (agencyId) {
            const [clientsRes, agentsRes] = await Promise.all([
              supabase
                .from("clients")
                .select("id, name, status")
                .eq("agency_id", agencyId)
                .is("deleted_at", null)
                .ilike("name", `%${trimmed}%`)
                .order("name")
                .limit(5),
              supabase
                .from("agents")
                .select("id, name, provider, status")
                .eq("agency_id", agencyId)
                .ilike("name", `%${trimmed}%`)
                .order("name")
                .limit(5),
            ]);

            (clientsRes.data || []).forEach((c) => {
              found.push({
                id: c.id,
                category: "client",
                label: c.name,
                sublabel: c.status || undefined,
                href: `/agency/clients/${c.id}`,
                Icon: Users,
              });
            });

            (agentsRes.data || []).forEach((a) => {
              found.push({
                id: a.id,
                category: "agent",
                label: a.name,
                sublabel: a.provider,
                href: `/agency/agents/${a.id}`,
                Icon: Bot,
              });
            });
          }
        } else {
          // client mode — use search_conversations RPC for the conversation half;
          // text_transcripts (voice) branch unchanged.
          const agentId = selectedAgentId;
          if (agentId) {
            // Cast to any: search_conversations is a fresh migration; supabase types
            // are only regenerated periodically.
            const rpcPromise = (supabase.rpc as any)("search_conversations", {
              p_agent_id: agentId,
              p_query: hasUsableQuery ? trimmed : null,
              p_start_date: dateRange.start ? dateRange.start.toISOString() : null,
              p_end_date: dateRange.end ? dateRange.end.toISOString() : null,
              p_statuses: dialogStatuses.length ? dialogStatuses : null,
              p_department_ids: dialogDepartments.length ? dialogDepartments : null,
              p_tags: dialogTags.length ? dialogTags : null,
              p_owner_id: dialogMyOnly && currentClientUserId ? currentClientUserId : null,
              p_limit: 20,
            });

            // Voice transcripts: keep existing client-side ILIKE — only when query has substance.
            const transcriptsPromise = hasUsableQuery
              ? supabase
                  .from("text_transcripts")
                  .select("id, user_name, user_email, user_phone, conversation_started_at")
                  .eq("agent_id", agentId)
                  .or(`user_name.ilike.%${trimmed}%,user_email.ilike.%${trimmed}%,user_phone.ilike.%${trimmed}%`)
                  .order("conversation_started_at", { ascending: false })
                  .limit(5)
              : Promise.resolve({ data: [] as any[], error: null });

            const [rpcRes, transcriptsRes] = await Promise.all([rpcPromise, transcriptsPromise]);

            if (rpcRes.error) {
              console.error("search_conversations RPC error:", rpcRes.error);
            }

            (rpcRes.data || []).forEach((row: any) => {
              const meta = row.metadata as any;
              const label =
                meta?.variables?.user_name ||
                row.caller_phone ||
                "Unknown caller";
              const sub = row.last_activity_at || row.started_at
                ? formatDistanceToNow(new Date(row.last_activity_at || row.started_at), { addSuffix: true })
                : row.status;
              const cardConv: CardConversation = {
                id: row.id,
                caller_phone: row.caller_phone,
                status: row.status,
                started_at: row.started_at,
                last_activity_at: row.last_activity_at,
                department_id: row.department_id ?? meta?.department_id ?? null,
                owner_id: row.owner_id ?? meta?.owner_id ?? null,
                owner_name: row.owner_name ?? meta?.owner_name ?? null,
                first_unanswered_message_at: row.first_unanswered_message_at ?? null,
                is_widget_test: row.is_widget_test ?? false,
                metadata: meta,
              };
              found.push({
                id: row.id,
                category: "conversation",
                label,
                sublabel: sub,
                href: `/?conversationId=${row.id}`,
                Icon: MessageSquare,
                conversation: cardConv,
                matchedField: row.matched_field,
                matchPrefix: row.match_prefix,
                matchHit: row.match_hit,
                matchSuffix: row.match_suffix,
              });
            });

            (transcriptsRes.data || []).forEach((t: any) => {
              const label =
                t.user_name ||
                t.user_email ||
                t.user_phone ||
                "Unknown user";
              const sub = t.conversation_started_at
                ? formatDistanceToNow(new Date(t.conversation_started_at), { addSuffix: true })
                : undefined;
              const selectedAgent = agents.find((a) => a.id === agentId);
              const isRetell = selectedAgent?.provider === "retell";
              found.push({
                id: t.id,
                category: "transcript",
                label,
                sublabel: sub,
                href: isRetell ? "/transcripts" : "/text-transcripts",
                Icon: FileText,
              });
            });
          }
        }
      } catch (err) {
        console.error("CommandSearch error:", err);
      }

      setResults(found);
      setLoading(false);
    },
    [
      searchMode,
      profile?.agency?.id,
      selectedAgentId,
      agents,
      dialogStatuses,
      dialogDepartments,
      dialogTags,
      dialogMyOnly,
      dateRange.start,
      dateRange.end,
      currentClientUserId,
      hasAnyFilter,
    ]
  );

  // Re-run search whenever query OR any filter / date changes.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    const hasUsableQuery = trimmed.length >= 3;

    // Empty query + no filters → blank out, show recents.
    if (!trimmed && !hasAnyFilter) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Sub-3-char query with no filters → blank out (matches trgm gate; show nothing).
    if (trimmed.length > 0 && !hasUsableQuery && !hasAnyFilter) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch, open, hasAnyFilter]);

  const handleSelect = (item: SearchResult) => {
    pushRecent(item);
    setOpen(false);
    navigate(item.href);
  };

  const toggleArrayValue = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  const categoryHeadings: Record<SearchCategory, string> = {
    conversation: "Conversations",
    transcript: "Transcripts",
    client: "Clients",
    agent: "Agents",
    agency: "Agencies",
  };

  const isClientMode = searchMode === "client";
  const showRecents = !query.trim() && !hasAnyFilter && recentItems.length > 0;
  const showEmptyPlaceholder = !query.trim() && !hasAnyFilter && recentItems.length === 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={getPlaceholder(searchMode)}
        value={query}
        onValueChange={setQuery}
      />

      {/* Filter chip rows — client mode only */}
      {isClientMode && (
        <div className="border-b px-3 py-2 space-y-1.5">
          {/* Date + Reset row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                  <CalendarDays className="h-3 w-3" />
                  {dateRange.label}
                  {dateRange.start && (
                    <X
                      className="h-3 w-3 ml-1 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDatePreset("all");
                        setCustomDateRange(undefined);
                      }}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant={datePreset === "all" ? "default" : "ghost"}
                    className="justify-start h-8 text-xs"
                    onClick={() => {
                      setDatePreset("all");
                      setCustomDateRange(undefined);
                      setDatePopoverOpen(false);
                    }}
                  >
                    All time
                  </Button>
                  <Button
                    size="sm"
                    variant={datePreset === "today" ? "default" : "ghost"}
                    className="justify-start h-8 text-xs"
                    onClick={() => {
                      setDatePreset("today");
                      setCustomDateRange(undefined);
                      setDatePopoverOpen(false);
                    }}
                  >
                    Today
                  </Button>
                  <Button
                    size="sm"
                    variant={datePreset === "7d" ? "default" : "ghost"}
                    className="justify-start h-8 text-xs"
                    onClick={() => {
                      setDatePreset("7d");
                      setCustomDateRange(undefined);
                      setDatePopoverOpen(false);
                    }}
                  >
                    Last 7 days
                  </Button>
                  <Button
                    size="sm"
                    variant={datePreset === "30d" ? "default" : "ghost"}
                    className="justify-start h-8 text-xs"
                    onClick={() => {
                      setDatePreset("30d");
                      setCustomDateRange(undefined);
                      setDatePopoverOpen(false);
                    }}
                  >
                    Last 30 days
                  </Button>
                  <div className="border-t mt-1 pt-1">
                    <Calendar
                      mode="range"
                      selected={customDateRange}
                      onSelect={(range) => {
                        setCustomDateRange(range);
                        if (range?.from) setDatePreset("custom");
                      }}
                      numberOfMonths={1}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => {
                seedFromDashboard();
                setDatePreset("all");
                setCustomDateRange(undefined);
              }}
            >
              <RotateCcw className="h-3 w-3" />
              Reset to dashboard
            </Button>

            {canUseMineFilter && currentClientUserId && (
              <Button
                size="sm"
                variant={dialogMyOnly ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setDialogMyOnly((m) => !m)}
              >
                Mine only
              </Button>
            )}
          </div>

          {/* Status row — colored dot prefix matches the dashboard's status filter */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[68px] shrink-0">
              Status
            </span>
            {STATUS_OPTIONS.map((s) => {
              const active = dialogStatuses.includes(s.value);
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleArrayValue(setDialogStatuses, s.value)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted/70 border-border",
                  )}
                >
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mr-1.5",
                      s.value === "with_ai" && "bg-green-500",
                      s.value === "waiting" && "bg-red-500",
                      s.value === "in_handover" && "bg-blue-500",
                      s.value === "aftercare" && "bg-yellow-500",
                      s.value === "needs_review" && "bg-amber-500",
                      s.value === "resolved" && "bg-gray-400",
                    )}
                  />
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Department row — only when more than one department; dept colors mirror dashboard */}
          {departments.length > 1 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[68px] shrink-0">
                Department
              </span>
              {departments.map((d) => {
                const active = dialogDepartments.includes(d.id);
                const color = d.color || "#6B7280";
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleArrayValue(setDialogDepartments, d.id)}
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors font-medium"
                    style={
                      active
                        ? {
                            backgroundColor: `${color}25`,
                            borderColor: color,
                            color: color,
                          }
                        : {
                            backgroundColor: `${color}15`,
                            borderColor: `${color}40`,
                            color: color,
                          }
                    }
                  >
                    {d.name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Tag row — only when tags enabled and any defined; show tag's own color as dot */}
          {tagsEnabled && availableTags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-[68px] shrink-0">
                Tag
              </span>
              {availableTags.map((t) => {
                const active = dialogTags.includes(t.label);
                const color = (t as any).color || "#6B7280";
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleArrayValue(setDialogTags, t.label)}
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                      active
                        ? "bg-foreground text-background border-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted/70 border-border",
                    )}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full mr-1.5"
                      style={{ backgroundColor: color }}
                    />
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CommandList>
        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && (query.trim() || hasAnyFilter) && results.length === 0 && (
          <CommandEmpty>
            {query.trim() && query.trim().length < 3 && !hasAnyFilter
              ? "Type at least 3 characters"
              : `No results${query.trim() ? ` for "${query.trim()}"` : ""}`}
          </CommandEmpty>
        )}

        {/* Recent items when query is empty */}
        {showRecents && (
          <CommandGroup heading="Recent">
            {recentItems.map((item) => (
              <CommandItem
                key={`recent-${item.id}`}
                value={`recent-${item.id}-${item.label}`}
                onSelect={() => handleSelect(item)}
                className="gap-2"
              >
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {showEmptyPlaceholder && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {getPlaceholder(searchMode)}
          </div>
        )}

        {/* Grouped results */}
        {!loading &&
          (Object.keys(grouped) as SearchCategory[]).map((cat) => (
            <CommandGroup key={cat} heading={categoryHeadings[cat] || cat}>
              {grouped[cat].map((item) => {
                if (isClientMode && cat === "conversation" && item.conversation) {
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.id}-${item.label}`}
                      onSelect={() => handleSelect(item)}
                      className="!p-0"
                    >
                      <div className="w-full">
                        <ConversationCard
                          conversation={item.conversation}
                          departments={departments}
                          tagsEnabled={tagsEnabled}
                          currentClientUserId={currentClientUserId}
                          showCheckbox={false}
                          pendingMeta={null}
                          responseThresholds={responseThresholds}
                          matchedField={item.matchedField}
                          matchPrefix={item.matchPrefix}
                          matchHit={item.matchHit}
                          matchSuffix={item.matchSuffix}
                          onClick={() => handleSelect(item)}
                        />
                      </div>
                    </CommandItem>
                  );
                }
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.id}-${item.label}`}
                    onSelect={() => handleSelect(item)}
                    className="gap-2"
                  >
                    <item.Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.sublabel && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {item.sublabel}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
      </CommandList>
    </CommandDialog>
  );
}
