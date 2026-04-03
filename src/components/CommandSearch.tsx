import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Users,
  Bot,
  Building2,
  Clock,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useMultiTenantAuth } from "@/hooks/useMultiTenantAuth";
import { useClientAgentContext } from "@/hooks/useClientAgentContext";
import { formatDistanceToNow } from "date-fns";
import type { LucideIcon } from "lucide-react";

type SearchCategory = "conversation" | "transcript" | "client" | "agent" | "agency";

interface SearchResult {
  id: string;
  category: SearchCategory;
  label: string;
  sublabel?: string;
  href: string;
  Icon: LucideIcon;
}

const RECENT_KEY = "search_recent";

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
    const existing = getRecent().filter((r) => r.id !== item.id);
    const next = [item, ...existing].slice(0, 5);
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

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);

  const navigate = useNavigate();
  const { userType, previewDepth, profile } = useMultiTenantAuth();
  const { selectedAgentId, agents } = useClientAgentContext();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchMode = getSearchMode(userType, previewDepth);

  // Load recent on open
  useEffect(() => {
    if (open) {
      setRecentItems(getRecent());
      setQuery("");
      setResults([]);
    }
  }, [open]);

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

  // Debounced search
  const runSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const found: SearchResult[] = [];

      try {
        if (searchMode === "admin") {
          // Search agencies
          const { data } = await supabase
            .from("agencies")
            .select("id, name, slug")
            .ilike("name", `%${q}%`)
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
                .ilike("name", `%${q}%`)
                .order("name")
                .limit(5),
              supabase
                .from("agents")
                .select("id, name, provider, status")
                .eq("agency_id", agencyId)
                .ilike("name", `%${q}%`)
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
          // client mode — search conversations + text_transcripts
          const agentId = selectedAgentId;
          if (agentId) {
            // fetch recent 50 conversations, filter client-side
            const [convsRes, transcriptsRes] = await Promise.all([
              supabase
                .from("conversations")
                .select("id, caller_phone, status, started_at, metadata")
                .eq("agent_id", agentId)
                .order("started_at", { ascending: false })
                .limit(50),
              supabase
                .from("text_transcripts")
                .select("id, user_name, user_email, user_phone, conversation_started_at")
                .eq("agent_id", agentId)
                .or(`user_name.ilike.%${q}%,user_email.ilike.%${q}%,user_phone.ilike.%${q}%`)
                .order("conversation_started_at", { ascending: false })
                .limit(5),
            ]);

            const qLower = q.toLowerCase();
            (convsRes.data || [])
              .filter((c) => {
                const meta = c.metadata as any;
                return (
                  c.caller_phone?.toLowerCase().includes(qLower) ||
                  meta?.variables?.user_name?.toLowerCase().includes(qLower) ||
                  meta?.variables?.user_email?.toLowerCase().includes(qLower)
                );
              })
              .slice(0, 5)
              .forEach((c) => {
                const meta = c.metadata as any;
                const label =
                  meta?.variables?.user_name ||
                  c.caller_phone ||
                  "Unknown caller";
                const sub = c.started_at
                  ? formatDistanceToNow(new Date(c.started_at), { addSuffix: true })
                  : c.status;
                found.push({
                  id: c.id,
                  category: "conversation",
                  label,
                  sublabel: sub,
                  href: `/?conversationId=${c.id}`,
                  Icon: MessageSquare,
                });
              });

            (transcriptsRes.data || []).forEach((t) => {
              const label =
                t.user_name ||
                t.user_email ||
                t.user_phone ||
                "Unknown user";
              const sub = t.conversation_started_at
                ? formatDistanceToNow(new Date(t.conversation_started_at), { addSuffix: true })
                : undefined;
              // Determine provider from selected agent
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
    [searchMode, profile?.agency?.id, selectedAgentId, agents]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
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
  }, [query, runSearch]);

  const handleSelect = (item: SearchResult) => {
    pushRecent(item);
    setOpen(false);
    navigate(item.href);
  };

  // Group results by category
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder={getPlaceholder(searchMode)}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Searching...
          </div>
        )}

        {!loading && query.trim() && results.length === 0 && (
          <CommandEmpty>No results for "{query}"</CommandEmpty>
        )}

        {/* Recent items when query is empty */}
        {!query.trim() && recentItems.length > 0 && (
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

        {!query.trim() && recentItems.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {getPlaceholder(searchMode)}
          </div>
        )}

        {/* Grouped results */}
        {!loading &&
          (Object.keys(grouped) as SearchCategory[]).map((cat) => (
            <CommandGroup
              key={cat}
              heading={categoryHeadings[cat] || cat}
            >
              {grouped[cat].map((item) => (
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
              ))}
            </CommandGroup>
          ))}
      </CommandList>
    </CommandDialog>
  );
}
